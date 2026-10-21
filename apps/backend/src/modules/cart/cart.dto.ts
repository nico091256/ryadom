import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CartItemInputDto {
  @ApiProperty({ example: 'product-uuid' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  product_id: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;
}

export class UpdateCartDto {
  @ApiProperty({ example: 'shop-uuid' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  shop_id: string;

  @ApiProperty({ type: [CartItemInputDto], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartItemInputDto)
  items: CartItemInputDto[];

  @ApiProperty({ example: false, required: false, description: 'Force overwrite existing cart if from different shop' })
  @IsOptional()
  @IsBoolean()
  clearOtherShop?: boolean;
}
