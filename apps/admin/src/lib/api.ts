const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface AdminUser {
  id: string;
  name: string;
  login: string;
  role: string;
}

class ApiService {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('localshop_admin_token');
  }

  setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('localshop_admin_token', token);
    }
  }

  removeToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('localshop_admin_token');
      localStorage.removeItem('localshop_admin_user');
    }
  }

  getUser(): AdminUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('localshop_admin_user');
    return raw ? JSON.parse(raw) : null;
  }

  setUser(user: AdminUser) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('localshop_admin_user', JSON.stringify(user));
    }
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as any),
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        this.removeToken();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorData.message || 'API request failed');
    }

    return res.json();
  }

  // Auth
  async login(login: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    this.setToken(data.accessToken);
    this.setUser(data.user);
    return data;
  }

  // Dashboard Stats
  async getDashboardStats() {
    return this.request('/admin/stats');
  }

  // Shops
  async getShops() {
    return this.request('/admin/shops');
  }

  async createShop(shopData: any) {
    return this.request('/admin/shops', {
      method: 'POST',
      body: JSON.stringify(shopData),
    });
  }

  async updateShop(shopId: string, shopData: any) {
    return this.request(`/admin/shops/${shopId}`, {
      method: 'PATCH',
      body: JSON.stringify(shopData),
    });
  }

  // Categories
  async getCategories() {
    return this.request('/categories');
  }

  async createCategory(catData: any) {
    return this.request('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(catData),
    });
  }

  async updateCategory(id: string, catData: any) {
    return this.request(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(catData),
    });
  }

  // Orders
  async getOrders(params?: { status?: string; shopId?: string; paymentMethod?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.shopId) query.append('shopId', params.shopId);
    if (params?.paymentMethod) query.append('paymentMethod', params.paymentMethod);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    const qs = query.toString();
    return this.request(`/orders${qs ? `?${qs}` : ''}`);
  }

  // Users
  async getUsers(search?: string, role?: string) {
    const query = new URLSearchParams();
    if (search) query.append('q', search);
    if (role) query.append('role', role);
    const qs = query.toString();
    return this.request(`/admin/users${qs ? `?${qs}` : ''}`);
  }

  async toggleBlockUser(userId: string, isBlocked: boolean) {
    return this.request(`/admin/users/${userId}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ is_blocked: isBlocked }),
    });
  }
}

export const api = new ApiService();
