import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '@localshop/shared';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'f7v3n2...', maxLength: 4096, description: 'FCM registration token for this device' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(4096)
  token: string;

  @ApiProperty({ example: DevicePlatform.ANDROID, enum: DevicePlatform })
  @IsNotEmpty()
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
