export type OrderStatus = 'new' | 'accepted' | 'on_the_way' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'online';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type UserRole = 'customer' | 'seller' | 'admin';
export type ShopStatus = 'pending' | 'active' | 'blocked';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUser {
  id: string;
  name: string | null;
  login: string | null;
  phone?: string | null;
  role: UserRole;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  total_amount: number;
  discount_amount: number;
  promo_code: string | null;
  customer_phone: string;
  created_at: string;
  shop: { id: string; name: string; phone?: string; address_text?: string } | null;
  customer: { id: string; name: string | null; phone: string | null } | null;
  itemsCount?: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price?: number;
}

export interface StatusHistoryEntry {
  id: string;
  status?: OrderStatus;
  to_status?: OrderStatus;
  from_status?: OrderStatus | null;
  reason: string | null;
  created_at: string;
  changed_by?: string | null;
  actor?: { id: string; name: string | null; role?: UserRole; login?: string | null } | null;
}

export interface AddressSnapshot {
  text?: string;
  address_text?: string;
  title?: string;
  lat?: number;
  lng?: number;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  door_code?: string | null;
  [key: string]: unknown;
}

export interface OrderDetail extends OrderSummary {
  address_snapshot: AddressSnapshot | null;
  comment: string | null;
  commission_amount: number;
  accepted_at: string | null;
  delivered_at: string | null;
  needs_attention: boolean;
  items: OrderItem[];
  status_history: StatusHistoryEntry[];
}

export interface DashboardStats {
  totals: {
    customers: number;
    sellers: number;
    shops: number;
    activeShops: number;
    openShopsNow: number;
    products: number;
    orders: number;
    ordersToday: number;
    revenueTiyin: number;
    revenueTodayTiyin: number;
    commissionTiyin: number;
    avgOrderTiyin: number;
    cancelRatePercent: number;
  };
  ordersByStatus: Record<OrderStatus, number>;
  daily: { date: string; orders: number; revenueTiyin: number }[];
  topShops: { id: string; name: string; orders: number; revenueTiyin: number }[];
  recentOrders: OrderSummary[];
}

export interface ShopOwner {
  id: string;
  login: string | null;
  name: string | null;
  phone: string | null;
  is_blocked: boolean;
  must_change_password?: boolean;
}

export interface Shop {
  id: string;
  owner_id: string;
  city_id: string;
  name: string;
  logo_url: string | null;
  phone: string;
  address_text: string;
  lat: number;
  lng: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
  is_active: boolean;
  status: ShopStatus;
  commission_rate_percent: number;
  created_at: string;
  updated_at: string;
  owner: ShopOwner | null;
  productCount: number;
  orderCount: number;
  revenueTiyin: number;
  isCurrentlyOpen: boolean;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name_uz: string;
  name_ru: string;
  name_en: string;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
  productCount?: number;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  price: number;
  image_url: string | null;
  stock: number;
  is_available: boolean;
  deleted_at: string | null;
  created_at: string;
  category?: Category | null;
}

export interface ShopDetail extends Shop {
  products: Product[];
  stats: { ordersToday: number; orders30d: number; revenue30dTiyin: number };
}

export interface Address {
  id: string;
  title: string;
  address_text: string;
  lat: number;
  lng: number;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  door_code?: string | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  name: string | null;
  phone: string | null;
  login: string | null;
  role: UserRole;
  language: string;
  is_blocked: boolean;
  created_at: string;
  ordersCount: number;
  totalSpentTiyin: number;
  shop?: { id: string; name: string } | null;
}

export interface UserDetail extends UserRow {
  addresses: Address[];
  recentOrders: OrderSummary[];
}

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  max_discount_tiyin: number | null;
  min_order_tiyin: number | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditTargetType = 'shop' | 'order' | 'user' | 'product' | 'category' | 'promo';

export type AuditAction =
  | 'shop.create'
  | 'shop.approve'
  | 'shop.block'
  | 'shop.unblock'
  | 'shop.reset_password'
  | 'shop.update'
  | 'order.cancel'
  | 'user.block'
  | 'user.unblock'
  | 'promo.create'
  | 'promo.update'
  | 'promo.delete'
  | 'category.create'
  | 'category.update'
  | 'category.delete'
  | 'product.update'
  | 'product.delete';

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: AuditAction | string;
  target_type: AuditTargetType | string;
  target_id: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  actor: { id: string; name: string | null; login: string | null } | null;
}

export interface CreateShopPayload {
  name: string;
  phone: string;
  address_text: string;
  lat: number;
  lng: number;
  open_time?: string;
  close_time?: string;
  seller_login: string;
  seller_password: string;
  seller_name?: string;
}

export interface UpdateShopPayload {
  name?: string;
  phone?: string;
  address_text?: string;
  lat?: number;
  lng?: number;
  open_time?: string;
  close_time?: string;
  is_open?: boolean;
  is_active?: boolean;
  commission_rate_percent?: number;
  logo_url?: string | null;
}

export interface CategoryPayload {
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  icon_url?: string;
}

export interface PromoPayload {
  code?: string;
  description?: string | null;
  discount_percent: number;
  max_discount_tiyin?: number | null;
  min_order_tiyin?: number | null;
  usage_limit?: number | null;
  is_active?: boolean;
  expires_at?: string | null;
}
