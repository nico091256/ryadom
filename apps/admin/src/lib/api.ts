import type {
  AdminUser,
  AuditLogEntry,
  Category,
  CategoryPayload,
  CreateShopPayload,
  DashboardStats,
  OrderDetail,
  OrderSummary,
  Paginated,
  Product,
  PromoCode,
  PromoPayload,
  Shop,
  ShopDetail,
  UpdateShopPayload,
  UserDetail,
  UserRow,
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/** Fired on `window` after a successful token refresh. */
export const TOKEN_REFRESHED_EVENT = 'ryadom:token-refreshed';

/**
 * Session model:
 *  - refresh token: httpOnly `ryadom_rt` cookie set by the API (never visible to JS, never stored here);
 *  - access token: in memory, mirrored to sessionStorage so a reload keeps the session;
 *  - user profile (non-secret): localStorage, so a new tab can resume via the cookie.
 */
const ACCESS_KEY = 'ryadom_admin_access';
const USER_KEY = 'ryadom_admin_user';
/** Pre-cookie keys (this panel and the previous one); removed once so no token lingers in localStorage. */
const LEGACY_KEYS = ['ryadom_admin_token', 'localshop_admin_token', 'localshop_admin_user'];

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
export function errorMessage(err: unknown, fallback = "Kutilmagan xatolik yuz berdi"): string {
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

/** Accepts either the paginated envelope or a bare array (older endpoints) and normalizes it. */
function toPaginated<T>(res: any, page = 1, limit = 20): Paginated<T> {
  if (Array.isArray(res)) {
    return { data: res, total: res.length, page: 1, limit: Math.max(res.length, limit) };
  }
  return {
    data: Array.isArray(res?.data) ? res.data : [],
    total: Number(res?.total ?? 0),
    page: Number(res?.page ?? page),
    limit: Number(res?.limit ?? limit),
  };
}

function normalizeShop<T extends Partial<Shop>>(s: any): T {
  return {
    ...s,
    status: s.status ?? (s.is_active ? 'active' : 'blocked'),
    productCount: s.productCount ?? s._count?.products ?? 0,
    orderCount: s.orderCount ?? s._count?.orders ?? 0,
    revenueTiyin: s.revenueTiyin ?? 0,
    isCurrentlyOpen: s.isCurrentlyOpen ?? (s.is_open && s.is_active),
  } as T;
}

function normalizeUser<T extends Partial<UserRow>>(u: any): T {
  return {
    ...u,
    ordersCount: u.ordersCount ?? u._count?.orders ?? 0,
    totalSpentTiyin: u.totalSpentTiyin ?? 0,
    shop: u.shop ?? (Array.isArray(u.shops) && u.shops[0] ? { id: u.shops[0].id, name: u.shops[0].name } : null),
  } as T;
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

  getUser(): AdminUser | null {
    if (typeof window === 'undefined') return null;
    this.cleanupLegacy();
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AdminUser) : null;
    } catch {
      return null;
    }
  }

  /**
   * True when an admin profile is present. The access token itself may be
   * missing (new tab); the first request then silently resumes via the cookie.
   */
  isAuthenticated(): boolean {
    const user = this.getUser();
    return !!user && user.role === 'admin';
  }

  private saveSession(token: string, user: AdminUser) {
    this.setToken(token);
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

    const headers: Record<string, string> = {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
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
  async login(login: string, password: string): Promise<AdminUser> {
    const data = await this.request<{ accessToken: string; user: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
      auth: false,
      // Ask the API to deliver the refresh token as an httpOnly cookie instead of in the body.
      headers: { 'X-Auth-Transport': 'cookie' },
      credentials: 'include',
    });
    if (!data?.user || data.user.role !== 'admin') {
      throw new ApiError("Kirish taqiqlangan: bu panel faqat administratorlar uchun.", 403, 'NOT_ADMIN');
    }
    this.saveSession(data.accessToken, data.user);
    return data.user;
  }

  // ---------- Dashboard ----------
  getStats() {
    return this.request<DashboardStats>('/admin/stats');
  }

  // ---------- Orders ----------
  async getOrders(params: {
    status?: string;
    shopId?: string;
    paymentMethod?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const res = await this.request(`/admin/orders${qs(params)}`);
    return toPaginated<OrderSummary>(res, params.page, params.limit);
  }

  getOrder(id: string) {
    return this.request<OrderDetail>(`/admin/orders/${id}`);
  }

  cancelOrder(id: string, reason: string) {
    return this.request<OrderDetail>(`/admin/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ---------- Shops ----------
  async getShops(params: { q?: string; status?: string; page?: number; limit?: number } = {}) {
    const res = await this.request(`/admin/shops${qs(params)}`);
    const p = toPaginated<Shop>(res, params.page, params.limit);
    return { ...p, data: p.data.map((s) => normalizeShop<Shop>(s)) };
  }

  async getShop(id: string) {
    const res = await this.request(`/admin/shops/${id}`);
    const shop = normalizeShop<ShopDetail>(res);
    return {
      ...shop,
      products: Array.isArray(shop.products) ? shop.products : [],
      stats: shop.stats ?? { ordersToday: 0, orders30d: 0, revenue30dTiyin: 0 },
    } as ShopDetail;
  }

  createShop(payload: CreateShopPayload) {
    return this.request<any>('/admin/shops', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateShop(id: string, payload: UpdateShopPayload) {
    return this.request<Shop>(`/admin/shops/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  resetShopPassword(id: string) {
    return this.request<{ login: string; tempPassword: string }>(`/admin/shops/${id}/reset-password`, {
      method: 'POST',
    });
  }

  async approveShop(id: string) {
    const res = await this.request(`/admin/shops/${id}/approve`, { method: 'POST' });
    return normalizeShop<Shop>(res);
  }

  async blockShop(id: string) {
    const res = await this.request(`/admin/shops/${id}/block`, { method: 'POST' });
    return normalizeShop<Shop>(res);
  }

  async unblockShop(id: string) {
    const res = await this.request(`/admin/shops/${id}/unblock`, { method: 'POST' });
    return normalizeShop<Shop>(res);
  }

  // ---------- Products ----------
  updateProduct(id: string, payload: { is_available?: boolean }) {
    return this.request<Product>(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  deleteProduct(id: string) {
    return this.request<{ success: boolean }>(`/admin/products/${id}`, { method: 'DELETE' });
  }

  // ---------- Users ----------
  async getUsers(params: { q?: string; role?: string; blocked?: string; page?: number; limit?: number }) {
    const res = await this.request(`/admin/users${qs(params)}`);
    const p = toPaginated<UserRow>(res, params.page, params.limit);
    return { ...p, data: p.data.map((u) => normalizeUser<UserRow>(u)) };
  }

  async getUserDetail(id: string) {
    const res = await this.request(`/admin/users/${id}`);
    const u = normalizeUser<UserDetail>(res);
    return {
      ...u,
      addresses: Array.isArray(u.addresses) ? u.addresses : [],
      recentOrders: Array.isArray(u.recentOrders) ? u.recentOrders : [],
    } as UserDetail;
  }

  setUserBlocked(id: string, isBlocked: boolean) {
    return this.request(`/admin/users/${id}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ is_blocked: isBlocked }),
    });
  }

  // ---------- Audit log ----------
  async getAuditLog(params: { actorId?: string; targetType?: string; action?: string; page?: number; limit?: number }) {
    const res = await this.request(`/admin/audit-log${qs(params)}`);
    return toPaginated<AuditLogEntry>(res, params.page, params.limit);
  }

  // ---------- Categories ----------
  getCategories() {
    return this.request<Category[]>('/admin/categories');
  }

  createCategory(payload: CategoryPayload) {
    return this.request<Category>('/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateCategory(id: string, payload: CategoryPayload) {
    return this.request<Category>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deleteCategory(id: string) {
    return this.request<{ success: boolean }>(`/admin/categories/${id}`, { method: 'DELETE' });
  }

  // ---------- Promo codes ----------
  getPromoCodes() {
    return this.request<PromoCode[]>('/admin/promo-codes');
  }

  createPromoCode(payload: PromoPayload) {
    return this.request<PromoCode>('/admin/promo-codes', { method: 'POST', body: JSON.stringify(payload) });
  }

  updatePromoCode(id: string, payload: Partial<PromoPayload>) {
    return this.request<PromoCode>(`/admin/promo-codes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  deletePromoCode(id: string) {
    return this.request<{ success: boolean }>(`/admin/promo-codes/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiService();
