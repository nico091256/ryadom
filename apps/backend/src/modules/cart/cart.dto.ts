import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CartItemInputDto {
  @ApiProperty({ example: 'product-uuid' })
  @IsNotEmpty()
  @IsString()
  product_id: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartDto {
  @ApiProperty({ example: 'shop-uuid' })
  @IsNotEmpty()
  @IsString()
  shop_id: string;

  @ApiProperty({ type: [CartItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemInputDto)
  items: CartItemInputDto[];

  @ApiProperty({ example: false, required: false, description: 'Force overwrite existing cart if from different shop' })
  @IsOptional()
  clearOtherShop?: boolean;
}
