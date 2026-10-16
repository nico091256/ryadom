import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminCreateShopDto {
  @ApiProperty({ example: 'Chilonzor Oziq-Ovqat' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '+998909876543' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor ko\'chasi, 28-do\'kon' })
  @IsNotEmpty()
  @IsString()
  address_text: string;

  @ApiProperty({ example: 41.2825 })
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 69.2150 })
  @IsNotEmpty()
  @IsNumber()
  lng: number;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001', required: false })
  @IsOptional()
  @IsString()
  city_id?: string;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  open_time?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  close_time?: string;

  @ApiProperty({ example: 'seller_newshop', description: 'Generated shopkeeper login username' })
  @IsNotEmpty()
  @IsString()
  seller_login: string;

  @ApiProperty({ example: 'ShopkeeperInitialPass123!', description: 'Initial password given to shopkeeper' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  seller_password: string;

  @ApiProperty({ example: 'Bakhtiyor Seller', required: false })
  @IsOptional()
  @IsString()
  seller_name?: string;
}

export class AdminUpdateShopDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address_text?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
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
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'open_time must be HH:mm' })
  open_time?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'close_time must be HH:mm' })
  close_time?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  logo_url?: string | null;
}

export class AdminCategoryDto {
  @ApiProperty({ example: 'Meva va sabzavotlar' })
  @IsNotEmpty()
  @IsString()
  name_uz: string;

  @ApiProperty({ example: 'Овощи и фрукты', required: false })
  @IsOptional()
  @IsString()
  name_ru?: string;

  @ApiProperty({ example: 'Fruits & Vegetables', required: false })
  @IsOptional()
  @IsString()
  name_en?: string;

  @ApiProperty({ example: 'apple-alt', required: false })
  @IsOptional()
  @IsString()
  icon_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parent_id?: string;
}

export class AdminCancelOrderDto {
  @ApiProperty({ example: 'Mijoz bilan bog\'lanib bo\'lmadi' })
  @IsNotEmpty()
  @IsString()
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
  code: string;

  @ApiProperty({ example: 'Yangi mijozlar uchun 10% chegirma', required: false })
  @IsOptional()
  @IsString()
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
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
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
