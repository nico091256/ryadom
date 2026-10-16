import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '@localshop/shared';

export class CreateOrderDto {
  @ApiProperty({ example: 'address-uuid', required: false, description: 'Saved address ID or custom address' })
  @IsOptional()
  @IsString()
  address_id?: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor 5-mavze, 12-uy' })
  @IsNotEmpty()
  @IsString()
  address_text: string;

  @ApiProperty({ example: 41.2840 })
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 69.2160 })
  @IsNotEmpty()
  @IsNumber()
  lng: number;

  @ApiProperty({ example: '+998901234567' })
  @IsNotEmpty()
  @IsString()
  customer_phone: string;

  @ApiProperty({ example: PaymentMethod.CASH, enum: PaymentMethod })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiProperty({ example: 'Iltimos eshik qo\'ng\'irog\'ini chaling', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ example: 'YANGI10', required: false, description: 'Optional promo code (validated server-side)' })
  @IsOptional()
  @IsString()
  promo_code?: string;
}

export class RejectOrderDto {
  @ApiProperty({ example: 'Mahsulot tugab qolgan', description: 'Reason is strictly required when rejecting' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Rejalar o\'zgardi', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ example: OrderStatus.ON_THE_WAY, enum: [OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED] })
  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class ReviewOrderDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: 'Whole stars, 1..5' })
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiProperty({ example: 'Juda tez yetkazildi, rahmat!', required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
