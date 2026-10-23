import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UZ_PHONE_MESSAGE, UZ_PHONE_REGEX } from '../auth/auth.dto';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOGIN_REGEX = /^[a-z0-9_.-]{3,64}$/i;

export class AdminCreateShopDto {
  @ApiProperty({ example: 'Chilonzor Oziq-Ovqat', maxLength: 120 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '+998909876543' })
  @IsNotEmpty()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: UZ_PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor ko\'chasi, 28-do\'kon', maxLength: 300 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  address_text: string;

  @ApiProperty({ example: 41.2825 })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 69.2150 })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  city_id?: string;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'open_time must be HH:mm' })
  open_time?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'close_time must be HH:mm' })
  close_time?: string;

  @ApiProperty({ example: 'seller_newshop', description: 'Shopkeeper login: 3-64 chars, letters/digits/_ . -' })
  @IsNotEmpty()
  @IsString()
  @Matches(LOGIN_REGEX, { message: 'seller_login must be 3-64 characters: letters, digits, _ . -' })
  seller_login: string;

  @ApiProperty({ example: 'ShopkeeperInitialPass123!', description: 'Initial password given to shopkeeper (6-128 chars)' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  seller_password: string;

  @ApiProperty({ example: 'Bakhtiyor Seller', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  seller_name?: string;
}

export class AdminUpdateShopDto {
  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: UZ_PHONE_MESSAGE })
  phone?: string;

  @ApiProperty({ required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address_text?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_open?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commission_rate_percent?: number;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'open_time must be HH:mm' })
  open_time?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'close_time must be HH:mm' })
  close_time?: string;

  @ApiProperty({ required: false, nullable: true, maxLength: 2048 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2048)
  logo_url?: string | null;
}

export class AdminCategoryDto {
  @ApiProperty({ example: 'Meva va sabzavotlar', maxLength: 80 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  name_uz: string;

  @ApiProperty({ example: 'Овощи и фрукты', required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name_ru?: string;

  @ApiProperty({ example: 'Fruits & Vegetables', required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name_en?: string;

  @ApiProperty({ example: 'apple-alt', required: false, maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  icon_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parent_id?: string;
}

/**
 * PUT /admin/categories/:id body. Every field optional; `parent_id: null`
 * detaches the category from its parent. A plain `Partial<AdminCategoryDto>`
 * would compile to `Object` and skip validation entirely.
 */
export class AdminUpdateCategoryDto {
  @ApiProperty({ required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name_uz?: string;

  @ApiProperty({ required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name_ru?: string;

  @ApiProperty({ required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name_en?: string;

  @ApiProperty({ required: false, nullable: true, maxLength: 2048 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2048)
  icon_url?: string | null;

  @ApiProperty({ required: false, nullable: true, maxLength: 64, description: 'null detaches from the parent' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  parent_id?: string | null;
}

export class AdminCancelOrderDto {
  @ApiProperty({ example: 'Mijoz bilan bog\'lanib bo\'lmadi', maxLength: 300 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class AdminBlockUserDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  is_blocked: boolean;
}

export class AdminUpdateProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}

export class AdminCreatePromoCodeDto {
  @ApiProperty({ example: 'YANGI10' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'code may contain only letters, digits, _ and -' })
  code: string;

  @ApiProperty({ example: 'Yangi mijozlar uchun 10% chegirma', required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ example: 10, description: 'Discount percent 1..100' })
  @IsInt()
  @Min(1)
  @Max(100)
  discount_percent: number;

  @ApiProperty({ example: 2000000, required: false, nullable: true, description: 'Discount cap in tiyin' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  max_discount_tiyin?: number | null;

  @ApiProperty({ example: 5000000, required: false, nullable: true, description: 'Minimum basket total in tiyin' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  min_order_tiyin?: number | null;

  @ApiProperty({ example: 100, required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  usage_limit?: number | null;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z', required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  expires_at?: string | null;
}

export class AdminUpdatePromoCodeDto {
  @ApiProperty({ required: false, maxLength: 300 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discount_percent?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  max_discount_tiyin?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  min_order_tiyin?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  usage_limit?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  expires_at?: string | null;
}
