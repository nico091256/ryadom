import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_SEARCH_RADIUS_METERS } from '@localshop/shared';
import { UZ_PHONE_MESSAGE, UZ_PHONE_REGEX } from '../auth/auth.dto';

const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const NEARBY_RADIUS_MIN_METERS = 100;
export const NEARBY_RADIUS_MAX_METERS = 10_000;

/** Query of GET /shops/nearby. Everything here ends up in a cache key and a SQL parameter, so bounds matter. */
export class NearbyQueryDto {
  @ApiProperty({ example: 41.2825, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 69.215, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({ example: DEFAULT_SEARCH_RADIUS_METERS, minimum: NEARBY_RADIUS_MIN_METERS, maximum: NEARBY_RADIUS_MAX_METERS, description: 'Metres' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(NEARBY_RADIUS_MIN_METERS)
  @Max(NEARBY_RADIUS_MAX_METERS)
  radius?: number = DEFAULT_SEARCH_RADIUS_METERS;

  @ApiPropertyOptional({ maxLength: 64, description: 'Only shops with available products in this category' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}

export const PRODUCTS_DEFAULT_LIMIT = 50;
export const PRODUCTS_MAX_LIMIT = 100;
/** Hard cap on the legacy (non-paginated) bare-array response. */
export const PRODUCTS_UNPAGED_CAP = 500;

/**
 * Query of GET /shops/:id/products. `page`/`limit` are optional on purpose: the
 * mobile client parses a bare array, so pagination is opt-in (see ShopsService.findShopProducts).
 */
export class ShopProductsQueryDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Case-insensitive name search (uz/ru/en)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, description: 'Enables the paginated envelope { data, total, page, limit }' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: PRODUCTS_MAX_LIMIT, default: PRODUCTS_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRODUCTS_MAX_LIMIT)
  limit?: number;
}

export class RegisterShopDto {
  @ApiProperty({ example: 'Chilonzor Oziq-Ovqat', maxLength: 120, description: 'Shop name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Bakhtiyor Aliyev', maxLength: 120, description: "Shop owner's full name" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  owner_name: string;

  @ApiProperty({ example: '+998909876543' })
  @IsNotEmpty()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: UZ_PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'seller_newshop', maxLength: 64, description: 'Login username chosen by the registrant' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  login: string;

  @ApiProperty({ example: 'MyOwnPassword123!', description: 'Password chosen by the registrant' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: "Toshkent sh., Chilonzor ko'chasi, 28-do'kon", maxLength: 300 })
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

  @ApiProperty({ example: 69.215 })
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
  @Matches(TIME_HH_MM, { message: 'open_time must be HH:mm' })
  open_time?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(TIME_HH_MM, { message: 'close_time must be HH:mm' })
  close_time?: string;
}
