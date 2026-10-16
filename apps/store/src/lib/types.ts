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
  totalPages?: number;
}

/** The signed-in shopkeeper, as persisted in localStorage. */
export interface StoreUser {
  id: string;
  name: string | null;
  login: string | null;
  phone: string | null;
  role: UserRole;
  language: string;
  must_change_password: boolean;
  shopId: string | null;
}

export interface City {
  id: string;
  name_uz?: string;
  name_ru?: string;
  name_en?: string;
  [key: string]: unknown;
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
  /** 'HH:mm' */
  open_time: string;
  /** 'HH:mm' */
  close_time: string;
  is_open: boolean;
  is_active: boolean;
  status: ShopStatus;
  commission_rate_percent: number;
  created_at: string;
  updated_at: string;
  city?: City | null;
}

export interface UpdateShopPayload {
  name?: string;
  phone?: string;
  logo_url?: string | null;
  address_text?: string;
  open_time?: string;
  close_time?: string;
  is_open?: boolean;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name_uz: string;
  name_ru: string;
  name_en: string;
  icon_url: string | null;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  description_uz: string | null;
  description_ru: string | null;
  description_en: string | null;
  /** Integer tiyin. */
  price: number;
  image_url: string | null;
  stock: number;
  is_available: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
}

export interface ProductPayload {
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  category_id: string;
  /** `null` clears the description on update. */
  description_uz?: string | null;
  description_ru?: string | null;
  description_en?: string | null;
  /** Integer tiyin >= 0. */
  price: number;
  image_url?: string | null;
  stock: number;
  is_available?: boolean;
}

export interface SellerStatsBucket {
  orderCount: number;
  revenueTiyin: number;
}

export interface SellerStats {
  today: SellerStatsBucket;
  thisWeek: SellerStatsBucket;
  thisMonth: SellerStatsBucket;
}

export interface AddressSnapshot {
  lat: number;
  lng: number;
  text: string;
  [key: string]: unknown;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  /** Integer tiyin. */
  unit_price: number;
  quantity: number;
  product?: {
    id: string;
    name_uz: string;
    name_ru: string;
    name_en: string;
    image_url: string | null;
  } | null;
}

export interface StatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
  actor?: { id: string; name: string | null; role?: UserRole; login?: string | null } | null;
}

export interface Order {
  id: string;
  customer_id: string;
  shop_id: string;
  address_snapshot: AddressSnapshot | null;
  customer_phone: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  /** Integer tiyin. */
  total_amount: number;
  commission_rate_percent: number;
  commission_amount: number;
  promo_code: string | null;
  discount_amount: number;
  comment: string | null;
  needs_attention: boolean;
  accepted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  shop?: { id: string; name: string; phone: string; logo_url: string | null } | null;
  customer?: { id: string; name: string | null; phone: string | null } | null;
  status_history?: StatusHistoryEntry[];
}
