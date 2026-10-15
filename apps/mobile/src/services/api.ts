import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getHost(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  }
  // When running via Expo Go on physical phones, hostUri holds the computer's LAN IP (e.g. 10.60.7.99:8082)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  // Fallback to local network IP for physical devices
  return '10.60.7.99';
}

export const HOST = getHost();
export const API_BASE_URL = `http://${HOST}:4000/api/v1`;
export const SOCKET_URL = `http://${HOST}:4000`;

class MobileApiClient {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }

  async setTokens(accessToken: string, refreshToken?: string) {
    try {
      await AsyncStorage.setItem('auth_token', accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem('refresh_token', refreshToken);
      }
    } catch (e) {
      console.warn('Failed to save tokens', e);
    }
  }

  async clearTokens() {
    try {
      await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
    } catch (e) {
      console.warn('Failed to clear tokens', e);
    }
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as any),
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Network request failed');
    }

    return res.json();
  }

  // Auth Endpoints
  async sendCode(phone: string) {
    return this.request('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyCode(phone: string, code: string) {
    const res = await this.request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    await this.setTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async login(login: string, password: string) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    await this.setTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // User & Profile
  async getProfile() {
    return this.request('/me');
  }

  async updateProfile(data: { name?: string; language?: string }) {
    return this.request('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async registerPushToken(pushToken: string) {
    return this.request('/me/push-token', {
      method: 'PUT',
      body: JSON.stringify({ pushToken }),
    });
  }

  // Addresses
  async getAddresses() {
    return this.request('/addresses');
  }

  async createAddress(addressData: {
    title: string;
    address_text: string;
    lat: number;
    lng: number;
    entrance?: string;
    floor?: string;
    apartment?: string;
    door_code?: string;
  }) {
    return this.request('/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData),
    });
  }

  async updateAddress(addressId: string, addressData: Record<string, any>) {
    return this.request(`/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(addressData),
    });
  }

  async deleteAddress(addressId: string) {
    return this.request(`/addresses/${addressId}`, { method: 'DELETE' });
  }

  // Shops & Nearby (within 3km)
  async getNearbyShops(lat: number, lng: number, radius = 3000, categoryId?: string) {
    const cat = categoryId ? `&category=${encodeURIComponent(categoryId)}` : '';
    return this.request(`/shops/nearby?lat=${lat}&lng=${lng}&radius=${radius}${cat}`);
  }

  async getShopDetails(shopId: string) {
    return this.request(`/shops/${shopId}`);
  }

  async getShopProducts(shopId: string, categoryId?: string, query?: string) {
    const params = new URLSearchParams();
    if (categoryId) params.append('category', categoryId);
    if (query) params.append('q', query);
    const qs = params.toString();
    return this.request(`/shops/${shopId}/products${qs ? `?${qs}` : ''}`);
  }

  async getCategories() {
    return this.request('/categories');
  }

  // Cart
  async getCart() {
    return this.request('/cart');
  }

  async updateCart(shopId: string, items: Array<{ product_id: string; quantity: number }>, clearOtherShop = false) {
    return this.request('/cart', {
      method: 'PUT',
      body: JSON.stringify({ shop_id: shopId, items, clearOtherShop }),
    });
  }

  async clearCart() {
    return this.request('/cart', { method: 'DELETE' });
  }

  // Orders
  async createOrder(orderData: {
    address_text: string;
    lat: number;
    lng: number;
    customer_phone: string;
    payment_method: string;
    comment?: string;
    promo_code?: string;
  }) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrders(status?: string) {
    return this.request(`/orders${status ? `?status=${status}` : ''}`);
  }

  async getOrderDetails(orderId: string) {
    return this.request(`/orders/${orderId}`);
  }

  async cancelOrder(orderId: string, reason?: string) {
    return this.request(`/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Seller Actions
  async getSellerShop() {
    return this.request('/seller/shop');
  }

  async updateSellerShop(shopData: any) {
    return this.request('/seller/shop', {
      method: 'PUT',
      body: JSON.stringify(shopData),
    });
  }

  async getSellerProducts() {
    return this.request('/seller/products');
  }

  async createSellerProduct(productData: any) {
    return this.request('/seller/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async updateSellerProduct(productId: string, productData: any) {
    return this.request(`/seller/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  async deleteSellerProduct(productId: string) {
    return this.request(`/seller/products/${productId}`, {
      method: 'DELETE',
    });
  }

  async acceptOrder(orderId: string) {
    return this.request(`/orders/${orderId}/accept`, { method: 'POST' });
  }

  async rejectOrder(orderId: string, reason: string) {
    return this.request(`/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getSellerStats() {
    return this.request('/seller/stats');
  }

  /**
   * Upload a picked image (expo-image-picker asset uri) and return its absolute URL.
   * The API answers with a server-relative path like /uploads/abc.jpg.
   */
  async uploadImage(uri: string, mimeType = 'image/jpeg'): Promise<string> {
    const token = await this.getToken();
    const url = `${API_BASE_URL}/uploads/image`;
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    let status: number;
    let bodyText: string;

    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      const form = new FormData();
      form.append('file', blob, `upload.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`);
      const res = await fetch(url, { method: 'POST', headers: authHeaders, body: form });
      status = res.status;
      bodyText = await res.text();
    } else {
      // SDK 57 swaps global fetch for expo/fetch, which can't send React Native
      // { uri, name, type } FormData parts — upload natively from the file instead.
      const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
      const res = await FileSystem.uploadAsync(url, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType,
        headers: authHeaders,
      });
      status = res.status;
      bodyText = res.body;
    }

    let data: any = {};
    try {
      data = JSON.parse(bodyText);
    } catch {}
    if (status < 200 || status >= 300) {
      throw new Error(data.message || 'Rasm yuklashda xatolik');
    }
    return `http://${HOST}:4000${data.url}`;
  }
}

export const mobileApi = new MobileApiClient();
