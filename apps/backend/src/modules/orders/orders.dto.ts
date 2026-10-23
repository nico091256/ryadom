import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '@localshop/shared';
import { UZ_PHONE_MESSAGE, UZ_PHONE_REGEX } from '../auth/auth.dto';

/** Query of GET /orders. Unknown params are rejected by the global ValidationPipe (forbidNonWhitelisted). */
export class ListOrdersQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ maxLength: 64, description: 'Admin only: restrict to one shop' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shopId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'address-uuid', required: false, description: 'Saved address ID or custom address' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  address_id?: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor 5-mavze, 12-uy', maxLength: 300 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  address_text: string;

  @ApiProperty({ example: 41.2840 })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 69.2160 })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ example: '+998901234567' })
  @IsNotEmpty()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: `customer_${UZ_PHONE_MESSAGE}` })
  customer_phone: string;

  @ApiProperty({ example: PaymentMethod.CASH, enum: PaymentMethod })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiProperty({ example: 'Iltimos eshik qo\'ng\'irog\'ini chaling', required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiProperty({ example: 'YANGI10', required: false, maxLength: 32, description: 'Optional promo code (validated server-side)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  promo_code?: string;
}

export class RejectOrderDto {
  @ApiProperty({ example: 'Mahsulot tugab qolgan', maxLength: 300, description: 'Reason is strictly required when rejecting' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Rejalar o\'zgardi', required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
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
