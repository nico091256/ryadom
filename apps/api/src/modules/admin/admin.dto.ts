import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
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
  commission_rate_percent?: number;
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
