import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Sardor Aliyev', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'uz', required: false, enum: ['uz', 'ru', 'en'] })
  @IsOptional()
  @IsString()
  language?: string;
}

export class RegisterPushTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsNotEmpty()
  @IsString()
  pushToken: string;
}

export class CreateAddressDto {
  @ApiProperty({ example: 'Uy', description: 'Address label: Uy, Ish, etc.' })
  @IsNotEmpty()
  @IsString()
  title: string;

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

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001', required: false })
  @IsOptional()
  @IsString()
  city_id?: string;

  @ApiProperty({ example: '2', required: false })
  @IsOptional()
  @IsString()
  entrance?: string;

  @ApiProperty({ example: '5', required: false })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiProperty({ example: '45', required: false })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiProperty({ example: '45K1234', required: false })
  @IsOptional()
  @IsString()
  door_code?: string;
}

export class UpdateAddressDto {
  @ApiProperty({ example: 'Uy', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor 5-mavze, 12-uy', required: false })
  @IsOptional()
  @IsString()
  address_text?: string;

  @ApiProperty({ example: 41.2840, required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ example: 69.2160, required: false })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({ example: '2', required: false })
  @IsOptional()
  @IsString()
  entrance?: string;

  @ApiProperty({ example: '5', required: false })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiProperty({ example: '45', required: false })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiProperty({ example: '45K1234', required: false })
  @IsOptional()
  @IsString()
  door_code?: string;
}
