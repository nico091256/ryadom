import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '@localshop/shared';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'f7v3n2...', description: 'FCM registration token for this device' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ example: DevicePlatform.ANDROID, enum: DevicePlatform })
  @IsNotEmpty()
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
