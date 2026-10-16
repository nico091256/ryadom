import { IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterShopDto {
  @ApiProperty({ example: 'Chilonzor Oziq-Ovqat', description: 'Shop name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Bakhtiyor Aliyev', description: "Shop owner's full name" })
  @IsNotEmpty()
  @IsString()
  owner_name: string;

  @ApiProperty({ example: '+998909876543' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: 'seller_newshop', description: 'Login username chosen by the registrant' })
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiProperty({ example: 'MyOwnPassword123!', description: 'Password chosen by the registrant' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: "Toshkent sh., Chilonzor ko'chasi, 28-do'kon" })
  @IsNotEmpty()
  @IsString()
  address_text: string;

  @ApiProperty({ example: 41.2825 })
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 69.215 })
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
}
