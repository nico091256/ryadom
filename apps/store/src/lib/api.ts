import type {
  Category,
  Order,
  OrderStatus,
  Paginated,
  Product,
  ProductPayload,
  SellerStats,
  Shop,
  StoreUser,
  UpdateShopPayload,
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
/** API_URL with the trailing '/api/v1' (and any trailing slash) removed. Uploads and the socket live here. */
export const API_ORIGIN = API_URL.replace(/\/+$/, '').replace(/\/api\/v1$/, '');

/** Fired on `window` after a successful token refresh (socket re-auth hook). */
export const TOKEN_REFRESHED_EVENT = 'ryadom:token-refreshed';

/**
 * Session model:
 *  - refresh token: httpOnly `ryadom_rt` cookie set by the API (never visible to JS, never stored here);
 *  - access token: in memory, mirrored to sessionStorage so a reload keeps the session;
 *  - user profile (non-secret): localStorage, so a new tab can resume via the cookie.
 */
const ACCESS_KEY = 'ryadom_store_access';
const USER_KEY = 'ryadom_store_user';
/** Pre-cookie keys; removed once so no refresh token lingers in localStorage. */
const LEGACY_KEYS = ['ryadom_store_token', 'ryadom_store_refresh'];

/** Turns a server-relative upload path ('/uploads/x.jpg') or an absolute URL into something an <img> can load. */
export function resolveMediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const v = String(pathOrUrl).trim();
  if (!v) return null;
  if (/^(https?:)?\/\//i.test(v) || /^(data|blob):/i.test(v)) return v;
  return `${API_ORIGIN}${v.startsWith('/') ? '' : '/'}${v}`;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Extract a human-readable message from any thrown value. */
export function errorMessage(err: unknown, fallback = 'Kutilmagan xatolik yuz berdi'): string {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err;
  return fallback;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(params?: Query): string {
  if (!params) return '';
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Accepts either the paginated envelope or a bare array and normalizes it. */
function toPaginated<T>(res: any, page = 1, limit = 100): Paginated<T> {
  if (Array.isArray(res)) {
    return { data: res, total: res.length, page: 1, limit: Math.max(res.length, limit), totalPages: 1 };
  }
  const total = Number(res?.total ?? 0);
  const lim = Number(res?.limit ?? limit) || limit;
  return {
    data: Array.isArray(res?.data) ? res.data : [],
    total,
    page: Number(res?.page ?? page),
    limit: lim,
    totalPages: Number(res?.totalPages ?? Math.max(1, Math.ceil(total / lim))),
  };
}

/** Cookie-transport login response: the refresh token is NOT in the body. */
interface LoginResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  user: {
    id: string;
    name: string | null;
    login: string | null;
    phone: string | null;
    role: StoreUser['role'];
    language?: string;
    must_change_password?: boolean;
    shopId?: string | null;
    shop?: { id: string; name: string; is_open: boolean } | null;
  };
}

type RequestOptions = RequestInit & {
  /** Attach the Bearer token (default true). */
  auth?: boolean;
  /** Internal: set when the request is already a retry after a token refresh. */
  _retried?: boolean;
};

class ApiService {
  /** Coalesces concurrent 401s into one refresh round-trip. */
  private refreshPromise: Promise<boolean> | null = null;
  private accessToken: string | null = null;
  private legacyCleaned = false;

  // ---------- Session storage ----------
  private cleanupLegacy() {
    if (this.legacyCleaned || typeof window === 'undefined') return;
    this.legacyCleaned = true;
    try {
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }

  getToken(): string | null {
    if (this.accessToken) return this.accessToken;
    if (typeof window === 'undefined') return null;
    this.cleanupLegacy();
    try {
      this.accessToken = sessionStorage.getItem(ACCESS_KEY);
    } catch {
      this.accessToken = null;
    }
    return this.accessToken;
  }

  private setToken(token: string | null) {
    this.accessToken = token;
    if (typeof window === 'undefined') return;
    try {
      if (token) sessionStorage.setItem(ACCESS_KEY, token);
      else sessionStorage.removeItem(ACCESS_KEY);
    } catch {
      /* ignore */
    }
  }

  getUser(): StoreUser | null {
    if (typeof window === 'undefined') return null;
    this.cleanupLegacy();
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as StoreUser) : null;
    } catch {
      return null;
    }
  }

  /**
   * True when a seller profile is present. The access token itself may be
   * missing (new tab); the first request then silently resumes via the cookie.
   */
  isAuthenticated(): boolean {
    const user = this.getUser();
    return !!user && user.role === 'seller';
  }

  saveUser(user: StoreUser): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }

  private clearSession() {
    this.setToken(null);
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(USER_KEY);
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }

  /** Revokes the cookie refresh token on the server (best effort) and always clears local state. */
  async logout(): Promise<void> {
    const hadSession = !!this.getUser() || !!this.getToken();
    const accessToken = this.getToken();
    this.clearSession();
    if (!hadSession || typeof window === 'undefined') return;
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: '{}',
        keepalive: true,
      });
    } catch {
      /* best effort */
    }
  }

  private expireSession() {
    this.clearSession();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login?expired=1');
    }
  }

  // ---------- Refresh (single-flight) ----------
  private refreshTokens(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        // The refresh token travels only in the httpOnly cookie; the server rotates it.
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: '{}',
        });
        if (!res.ok) return false;
        const data = (await res.json().catch(() => null)) as { accessToken?: string } | null;
        if (!data?.accessToken) return false;
        this.setToken(data.accessToken);
        // Let long-lived consumers (the Socket.IO client) re-authenticate with the new token.
        window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT));
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  // ---------- Core request ----------
  private async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true, _retried = false, ...init } = options;
    let token = auth ? this.getToken() : null;

    // New tab / lost in-memory token but a profile exists: resume via the cookie first.
    if (auth && !token && !_retried && typeof window !== 'undefined' && this.getUser()) {
      if (await this.refreshTokens()) {
        token = this.getToken();
      } else {
        this.expireSession();
        throw new ApiError('Sessiya tugadi. Qaytadan kiring.', 401, 'SESSION_EXPIRED');
      }
    }

    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const headers: Record<string, string> = {
      // Let the browser set the multipart boundary for FormData bodies.
      ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    };

    let res: Response;
    try {
      res = await fetch(`${API_URL}${endpoint}`, { ...init, headers });
    } catch {
      throw new ApiError("Server bilan aloqa yo'q. Internet yoki API serverni tekshiring.", 0, 'NETWORK_ERROR');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const rawMsg = body?.message;
      const message = Array.isArray(rawMsg) ? rawMsg.join(', ') : rawMsg || res.statusText || "So'rov bajarilmadi";

      const isAuthEndpoint = endpoint.startsWith('/auth/');
      if (res.status === 401 && auth && !isAuthEndpoint && typeof window !== 'undefined') {
        if (!_retried) {
          const refreshed = await this.refreshTokens();
          if (refreshed) {
            return this.request<T>(endpoint, { ...options, _retried: true });
          }
        }
        this.expireSession();
        throw new ApiError('Sessiya tugadi. Qaytadan kiring.', 401, body?.code);
      }
      throw new ApiError(message, res.status, body?.code);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // ---------- Auth ----------
  async login(login: string, password: string): Promise<StoreUser> {
    const data = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
      auth: false,
      // Ask the API to deliver the refresh token as an httpOnly cookie instead of in the body.
      headers: { 'X-Auth-Transport': 'cookie' },
      credentials: 'include',
    });
    if (!data?.user || data.user.role !== 'seller') {
      throw new ApiError("Bu panel faqat do'konchilar uchun", 403, 'NOT_SELLER');
    }
    const u = data.user;
    const user: StoreUser = {
      id: u.id,
      name: u.name ?? null,
      login: u.login ?? null,
      phone: u.phone ?? null,
      role: u.role,
      language: u.language ?? 'uz',
      must_change_password: !!u.must_change_password,
      shopId: u.shopId ?? u.shop?.id ?? null,
    };
    this.setToken(data.accessToken);
    this.saveUser(user);
    return user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    // The server revokes every refresh token (all devices) and issues a new pair for this one:
    // the rotated refresh token arrives as the httpOnly cookie, the access token in the body.
    const data = await this.request<{ success: boolean; message?: string; accessToken?: string }>(
      '/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
        headers: { 'X-Auth-Transport': 'cookie' },
        credentials: 'include',
      },
    );
    if (data?.accessToken) this.setToken(data.accessToken);
    const user = this.getUser();
    if (user) this.saveUser({ ...user, must_change_password: false });
  }

  // ---------- Seller: shop ----------
  getShop() {
    return this.request<Shop>('/seller/shop');
  }

  updateShop(payload: UpdateShopPayload) {
    return this.request<Shop>('/seller/shop', { method: 'PUT', body: JSON.stringify(payload) });
  }

  // ---------- Seller: products ----------
  async getProducts(): Promise<Product[]> {
    const res = await this.request<any>('/seller/products');
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.data) ? res.data : [];
  }

  createProduct(payload: ProductPayload) {
    return this.request<Product>('/seller/products', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateProduct(id: string, payload: Partial<ProductPayload>) {
    return this.request<Product>(`/seller/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.request<{ success: boolean; message?: string }>(`/seller/products/${id}`, { method: 'DELETE' });
  }

  // ---------- Categories (public) ----------
  async getCategories(): Promise<Category[]> {
    const res = await this.request<any>('/categories', { auth: false });
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.data) ? res.data : [];
  }

  // ---------- Seller: stats ----------
  getStats() {
    return this.request<SellerStats>('/seller/stats');
  }

  // ---------- Uploads ----------
  /** Returns the server-relative url ('/uploads/<uuid>.<ext>'); resolve for display with resolveMediaUrl(). */
  async uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await this.request<{ url: string }>('/uploads/image', { method: 'POST', body: form });
    if (!res?.url) throw new ApiError('Rasm yuklanmadi', 500, 'UPLOAD_FAILED');
    return res.url;
  }

  // ---------- Orders ----------
  async getOrders(params: { status?: OrderStatus; limit?: number; page?: number } = {}): Promise<Paginated<Order>> {
    const limit = params.limit ?? 100;
    const page = params.page ?? 1;
    const res = await this.request(`/orders${qs({ status: params.status, page, limit })}`);
    return toPaginated<Order>(res, page, limit);
  }

  getOrder(id: string) {
    return this.request<Order>(`/orders/${id}`);
  }

  acceptOrder(id: string) {
    return this.request<Order>(`/orders/${id}/accept`, { method: 'POST' });
  }

  rejectOrder(id: string, reason: string) {
    return this.request<Order>(`/orders/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  cancelOrder(id: string, reason: string) {
    return this.request<Order>(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  updateOrderStatus(id: string, status: 'on_the_way' | 'delivered') {
    return this.request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }
}

export const api = new ApiService();
