import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupportedLanguage } from '@localshop/shared';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Sardor Aliyev', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: SupportedLanguage.UZ, required: false, enum: SupportedLanguage })
  @IsOptional()
  @IsEnum(SupportedLanguage, { message: 'language must be one of: uz, ru, en' })
  language?: SupportedLanguage;
}

export class CreateAddressDto {
  @ApiProperty({ example: 'Uy', maxLength: 120, description: 'Address label: Uy, Ish, etc.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  title: string;

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

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  city_id?: string;

  @ApiProperty({ example: '2', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  entrance?: string;

  @ApiProperty({ example: '5', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  floor?: string;

  @ApiProperty({ example: '45', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  apartment?: string;

  @ApiProperty({ example: '45K1234', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  door_code?: string;
}

export class UpdateAddressDto {
  @ApiProperty({ example: 'Uy', required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor 5-mavze, 12-uy', required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address_text?: string;

  @ApiProperty({ example: 41.2840, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiProperty({ example: 69.2160, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiProperty({ example: '2', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  entrance?: string;

  @ApiProperty({ example: '5', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  floor?: string;

  @ApiProperty({ example: '45', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  apartment?: string;

  @ApiProperty({ example: '45K1234', required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  door_code?: string;
}
