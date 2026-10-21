import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UZ_PHONE_MESSAGE, UZ_PHONE_REGEX } from '../auth/auth.dto';

const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

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
