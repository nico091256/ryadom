import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateShopProfileDto {
  @ApiProperty({ example: 'Chilonzor Oziq-Ovqat', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '+998909876543', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'https://images.unsplash.com/...', required: false })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor ko\'chasi, 28-do\'kon', required: false })
  @IsOptional()
  @IsString()
  address_text?: string;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  open_time?: string;

  @ApiProperty({ example: '23:00', required: false })
  @IsOptional()
  @IsString()
  close_time?: string;

  @ApiProperty({ example: true, required: false, description: 'Prominent Open / Closed toggle switch' })
  @IsOptional()
  @IsBoolean()
  is_open?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Samarqand noni' })
  @IsNotEmpty()
  @IsString()
  name_uz: string;

  @ApiProperty({ example: 'Самаркандская лепешка', required: false })
  @IsOptional()
  @IsString()
  name_ru?: string;

  @ApiProperty({ example: 'Samarkand Flatbread', required: false })
  @IsOptional()
  @IsString()
  name_en?: string;

  @ApiProperty({ example: 'category-uuid' })
  @IsNotEmpty()
  @IsString()
  category_id: string;

  @ApiProperty({ example: 'Issiq va xushbo\'y an\'anaviy tandir noni', required: false })
  @IsOptional()
  @IsString()
  description_uz?: string;

  @ApiProperty({ example: 'Традиционная самаркандская лепешка', required: false })
  @IsOptional()
  @IsString()
  description_ru?: string;

  @ApiProperty({ example: 'Fresh traditional Samarkand tandoor bread', required: false })
  @IsOptional()
  @IsString()
  description_en?: string;

  @ApiProperty({ example: 800000, description: 'Price in tiyin (e.g. 8000 UZS = 800000 tiyin)' })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'https://images.unsplash.com/...', required: false })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiProperty({ example: 50, description: 'Stock quantity' })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}

export class UpdateProductDto {
  @ApiProperty({ example: 'Samarqand noni', required: false })
  @IsOptional()
  @IsString()
  name_uz?: string;

  @ApiProperty({ example: 'Самаркандская лепешка', required: false })
  @IsOptional()
  @IsString()
  name_ru?: string;

  @ApiProperty({ example: 'Samarkand Flatbread', required: false })
  @IsOptional()
  @IsString()
  name_en?: string;

  @ApiProperty({ example: 'category-uuid', required: false })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description_uz?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description_ru?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description_en?: string;

  @ApiProperty({ example: 850000, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiProperty({ example: 45, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}
