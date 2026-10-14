import { IsNotEmpty, IsPhoneNumber, IsString, Length, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendCodeDto {
  @ApiProperty({ example: '+998901234567', description: 'Customer international phone number' })
  @IsNotEmpty()
  @IsString()
  phone: string;
}

export class VerifyCodeDto {
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit SMS verification code' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}

export class LoginDto {
  @ApiProperty({ example: 'seller_chilonzor', description: 'Shopkeeper or Admin login username' })
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiProperty({ example: 'Shopkeeper123!', description: 'Account password' })
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token provided on authentication' })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Shopkeeper123!', description: 'Current password' })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecretPass456!', description: 'New strong password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}
