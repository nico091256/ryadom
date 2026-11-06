import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_PRODUCT_PRICE_TIYIN, MAX_PRODUCT_STOCK } from '@localshop/shared';
import { PRODUCT_CODE_MESSAGE, PRODUCT_CODE_REGEX } from '../seller/seller.dto';
import { POS_SYNC_MAX_ITEMS } from './pos.constants';

/** One product in a POS sync: matched by barcode first, then by sku. Only the sent fields change. */
export class PosSyncItemDto {
  @ApiPropertyOptional({ example: '4780000000012', description: 'EAN/UPC or internal barcode' })
  @IsOptional()
  @IsString()
  @Matches(PRODUCT_CODE_REGEX, { message: `barcode ${PRODUCT_CODE_MESSAGE}` })
  barcode?: string;

  @ApiPropertyOptional({ example: 'MLK-32-1L' })
  @IsOptional()
  @IsString()
  @Matches(PRODUCT_CODE_REGEX, { message: `sku ${PRODUCT_CODE_MESSAGE}` })
  sku?: string;

  @ApiPropertyOptional({ example: 1300000, description: 'Price in tiyin (13 000 so\'m = 1300000)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRODUCT_PRICE_TIYIN)
  price?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRODUCT_STOCK)
  stock?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;

  @ApiPropertyOptional({ example: 'Lactel Sut 2.5% 1L', maxLength: 120, description: 'Product name (enables auto-creation if barcode/sku is new)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Lactel Sut 2.5% 1L', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_uz?: string;

  @ApiPropertyOptional({ example: 'Молоко Lactel 2.5% 1л', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_ru?: string;

  @ApiPropertyOptional({ example: 'Lactel Milk 2.5% 1L', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_en?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description_uz?: string;

  @ApiPropertyOptional({ example: 'c-2', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category_id?: string;

  @ApiPropertyOptional({ example: 'Sut va sut mahsulotlari', maxLength: 120, description: 'REGOS group name (matched to platform category)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category_name?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image_url?: string;
}

export class PosSyncProductsDto {
  @ApiProperty({ type: [PosSyncItemDto], maxItems: POS_SYNC_MAX_ITEMS })
  @ValidateNested({ each: true })
  @Type(() => PosSyncItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(POS_SYNC_MAX_ITEMS)
  items: PosSyncItemDto[];
}

export const POS_PULLABLE_STATUSES = ['new', 'accepted', 'on_the_way'] as const;

export class PosPendingOrdersQueryDto {
  @ApiPropertyOptional({ enum: POS_PULLABLE_STATUSES, default: 'new' })
  @IsOptional()
  @IsIn(POS_PULLABLE_STATUSES as unknown as string[])
  status?: (typeof POS_PULLABLE_STATUSES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export const POS_SETTABLE_STATUSES = ['accepted', 'on_the_way', 'delivered', 'cancelled'] as const;

export class PosOrderStatusDto {
  @ApiProperty({ enum: POS_SETTABLE_STATUSES })
  @IsIn(POS_SETTABLE_STATUSES as unknown as string[])
  status: (typeof POS_SETTABLE_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 500, description: 'Required when cancelling' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
