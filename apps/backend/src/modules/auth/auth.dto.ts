import { IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Uzbek E.164 number: +998 followed by exactly 9 digits. */
export const UZ_PHONE_REGEX = /^\+998\d{9}$/;
export const UZ_PHONE_MESSAGE = 'phone must be in +998XXXXXXXXX format';

export class SendCodeDto {
  @ApiProperty({ example: '+998901234567', description: 'Customer international phone number' })
  @IsNotEmpty()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: UZ_PHONE_MESSAGE })
  phone: string;
}

export class VerifyCodeDto {
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsNotEmpty()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: UZ_PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit SMS verification code' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;
}

export class LoginDto {
  @ApiProperty({ example: 'seller_chilonzor', description: 'Shopkeeper or Admin login username' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  login: string;

  @ApiProperty({ example: 'Shopkeeper123!', description: 'Account password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  password: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token provided on authentication. Optional for web panels using the httpOnly cookie transport (body wins when both are present).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Shopkeeper123!', description: 'Current password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ example: 'NewSecretPass456!', description: 'New strong password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword: string;
}
