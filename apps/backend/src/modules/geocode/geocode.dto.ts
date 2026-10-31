import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Query of GET /geocode/reverse — a point to turn into a human address. */
export class ReverseGeocodeQueryDto {
  @ApiProperty({ example: 41.311081, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 69.240562, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({ example: 'uz', maxLength: 5, description: 'uz | ru | en (Yandex ko\'rsatuvchi tiliga moslanadi)' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  lang?: string;
}
