import { DevicePlatform, OrderStatus, PaymentMethod, PaymentStatus, ShopStatus, SupportedLanguage, UserRole } from './enums';

export interface LocalizedString {
  uz: string;
  ru?: string;
  en?: string;
}

export interface CityDto {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserDto {
  id: string;
  phone: string | null;
  name: string | null;
  role: UserRole;
  login: string | null;
  language: SupportedLanguage;
  is_blocked: boolean;
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressDto {
  id: string;
  user_id: string;
  title: string;
  address_text: string;
  lat: number;
  lng: number;
  city_id: string;
  created_at: string;
  updated_at: string;
}

export interface ShopDto {
  id: string;
  owner_id: string;
  city_id: string;
  name: string;
  logo_url: string | null;
  phone: string;
  address_text: string;
  lat: number;
  lng: number;
  open_time: string; // HH:mm
  close_time: string; // HH:mm
  is_open: boolean;
  is_active: boolean;
  status: ShopStatus;
  commission_rate_percent: number;
  distanceMeters?: number;
  isCurrentlyOpen?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryDto {
  id: string;
  parent_id: string | null;
  name_uz: string;
  name_ru: string;
  name_en: string;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductDto {
  id: string;
  shop_id: string;
  category_id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  description_uz: string | null;
  description_ru: string | null;
  description_en: string | null;
  price: number; // in tiyin
  image_url: string | null;
  stock: number;
  is_available: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItemDto {
  id: string;
  product_id: string;
  quantity: number;
  product?: ProductDto;
}

export interface CartDto {
  id: string;
  user_id: string;
  shop_id: string;
  shop?: ShopDto;
  items: CartItemDto[];
  total_amount: number; // in tiyin
}

export interface AddressSnapshot {
  lat: number;
  lng: number;
  text: string;
  title?: string;
}

export interface OrderItemDto {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number; // in tiyin
  quantity: number;
  subtotal: number; // in tiyin
}

export interface OrderStatusHistoryDto {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string; // user id
  reason: string | null;
  created_at: string;
}

export interface OrderDto {
  id: string;
  customer_id: string;
  shop_id: string;
  shop_name?: string;
  shop_phone?: string;
  customer_name?: string;
  address_snapshot: AddressSnapshot;
  customer_phone: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  total_amount: number; // in tiyin
  commission_rate_percent: number;
  commission_amount: number; // in tiyin
  comment: string | null;
  needs_attention: boolean;
  accepted_at: string | null;
  delivered_at: string | null;
  items: OrderItemDto[];
  status_history?: OrderStatusHistoryDto[];
  created_at: string;
  updated_at: string;
}

export interface DeviceTokenDto {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}
