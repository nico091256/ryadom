import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_PRODUCT_PRICE_TIYIN, MAX_PRODUCT_STOCK } from '@localshop/shared';
import { UZ_PHONE_MESSAGE, UZ_PHONE_REGEX } from '../auth/auth.dto';

const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_MAX = 2048;

export const SELLER_PRODUCTS_DEFAULT_LIMIT = 50;
export const SELLER_PRODUCTS_MAX_LIMIT = 100;
/** Hard cap on the legacy (non-paginated) bare-array response. */
export const SELLER_PRODUCTS_UNPAGED_CAP = 500;

/**
 * Query of GET /seller/products. Pagination is opt-in: the store panel parses a
 * bare array today, so the envelope is only returned when page or limit is sent.
 */
export class SellerProductsQueryDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Enables the paginated envelope { data, total, page, limit }' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: SELLER_PRODUCTS_MAX_LIMIT, default: SELLER_PRODUCTS_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SELLER_PRODUCTS_MAX_LIMIT)
  limit?: number;
}

export class UpdateShopProfileDto {
  @ApiProperty({ example: 'Chilonzor Oziq-Ovqat', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: '+998909876543', required: false })
  @IsOptional()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: UZ_PHONE_MESSAGE })
  phone?: string;

  @ApiProperty({ example: '/uploads/logo.jpg', required: false, nullable: true, maxLength: URL_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(URL_MAX)
  logo_url?: string | null;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor ko\'chasi, 28-do\'kon', required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address_text?: string;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(TIME_HH_MM, { message: 'open_time must be HH:mm' })
  open_time?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(TIME_HH_MM, { message: 'close_time must be HH:mm' })
  close_time?: string;

  @ApiProperty({ example: true, required: false, description: 'Prominent Open / Closed toggle switch' })
  @IsOptional()
  @IsBoolean()
  is_open?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Samarqand noni', maxLength: 120 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name_uz: string;

  @ApiProperty({ example: 'Самаркандская лепешка', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_ru?: string;

  @ApiProperty({ example: 'Samarkand Flatbread', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_en?: string;

  @ApiProperty({ example: 'category-uuid' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  category_id: string;

  @ApiProperty({ example: 'Issiq va xushbo\'y an\'anaviy tandir noni', required: false, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description_uz?: string | null;

  @ApiProperty({ example: 'Традиционная самаркандская лепешка', required: false, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description_ru?: string | null;

  @ApiProperty({ example: 'Fresh traditional Samarkand tandoor bread', required: false, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description_en?: string | null;

  @ApiProperty({ example: 800000, maximum: MAX_PRODUCT_PRICE_TIYIN, description: 'Price in tiyin (e.g. 8000 UZS = 800000 tiyin)' })
  @IsInt()
  @Min(0)
  @Max(MAX_PRODUCT_PRICE_TIYIN)
  price: number;

  @ApiProperty({ example: '/uploads/product.jpg', required: false, nullable: true, maxLength: URL_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(URL_MAX)
  image_url?: string | null;

  @ApiProperty({ example: 50, maximum: MAX_PRODUCT_STOCK, description: 'Stock quantity' })
  @IsInt()
  @Min(0)
  @Max(MAX_PRODUCT_STOCK)
  stock: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}

export class UpdateProductDto {
  @ApiProperty({ example: 'Samarqand noni', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_uz?: string;

  @ApiProperty({ example: 'Самаркандская лепешка', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_ru?: string;

  @ApiProperty({ example: 'Samarkand Flatbread', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_en?: string;

  @ApiProperty({ example: 'category-uuid', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category_id?: string;

  @ApiProperty({ required: false, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description_uz?: string | null;

  @ApiProperty({ required: false, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description_ru?: string | null;

  @ApiProperty({ required: false, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description_en?: string | null;

  @ApiProperty({ example: 850000, required: false, maximum: MAX_PRODUCT_PRICE_TIYIN })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRODUCT_PRICE_TIYIN)
  price?: number;

  @ApiProperty({ required: false, nullable: true, maxLength: URL_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(URL_MAX)
  image_url?: string | null;

  @ApiProperty({ example: 45, required: false, maximum: MAX_PRODUCT_STOCK })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRODUCT_STOCK)
  stock?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}
