import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ISmsService, SMS_SERVICE } from '../sms/sms.interface';
import { SendCodeDto, VerifyCodeDto, LoginDto, ChangePasswordDto } from './auth.dto';
import { REFRESH_TOKEN_TTL_DAYS, UserRole } from '@localshop/shared';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(SMS_SERVICE) private smsService: ISmsService,
  ) {}

  async sendCode(dto: SendCodeDto) {
    const phone = dto.phone.trim();

    // Check rate limit: recent code sent within 30 seconds
    const existing = await this.prisma.smsCode.findFirst({
      where: {
        phone,
        created_at: { gte: new Date(Date.now() - 30 * 1000) },
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Please wait at least 30 seconds before requesting another SMS code.',
      });
    }

    // In dev / test or mock provider, code is 123456
    const code = process.env.NODE_ENV === 'production' && this.configService.get('SMS_PROVIDER') === 'eskiz'
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '123456';

    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    // Delete older expired codes for this phone
    await this.prisma.smsCode.deleteMany({
      where: { phone },
    });

    await this.prisma.smsCode.create({
      data: {
        phone,
        code_hash: codeHash,
        attempts: 0,
        expires_at: expiresAt,
      },
    });

    const smsMessage = `LocalShop tasdiqlash kodi: ${code}. Hech kimga bermang!`;
    await this.smsService.sendSms(phone, smsMessage);

    return {
      success: true,
      message: 'Verification code sent successfully',
      phone,
      expiresInSeconds: 120,
    };
  }

  async verifyCode(dto: VerifyCodeDto) {
    const phone = dto.phone.trim();
    const code = dto.code.trim();

    const smsRecord = await this.prisma.smsCode.findFirst({
      where: { phone },
      orderBy: { created_at: 'desc' },
    });

    if (!smsRecord) {
      throw new BadRequestException({
        code: 'INVALID_SMS_CODE',
        message: 'No active verification code found for this phone number.',
      });
    }

    if (smsRecord.attempts >= 5) {
      throw new BadRequestException({
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many invalid attempts. Please request a new verification code.',
      });
    }

    if (new Date() > smsRecord.expires_at) {
      throw new BadRequestException({
        code: 'SMS_CODE_EXPIRED',
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    const isMatch = await bcrypt.compare(code, smsRecord.code_hash);
    if (!isMatch) {
      await this.prisma.smsCode.update({
        where: { id: smsRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({
        code: 'INVALID_SMS_CODE',
        message: 'Incorrect verification code entered.',
      });
    }

    // Code is verified, delete the SMS record
    await this.prisma.smsCode.delete({ where: { id: smsRecord.id } });

    // Find or create customer
    let user = await this.prisma.user.findUnique({
      where: { phone },
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          phone,
          role: UserRole.CUSTOMER,
          language: 'uz',
          is_blocked: false,
        },
      });
    }

    if (user.is_blocked) {
      throw new UnauthorizedException({
        code: 'USER_BLOCKED',
        message: 'Your account has been suspended.',
      });
    }

    const tokens = await this.generateTokens(user.id, user.role, { phone: user.phone || undefined });

    return {
      ...tokens,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        language: user.language,
      },
    };
  }

  async login(dto: LoginDto) {
    const login = dto.login.trim();
    const user = await this.prisma.user.findUnique({
      where: { login },
      include: {
        shops: {
          select: { id: true, name: true, is_open: true },
        },
      },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect login username or password.',
      });
    }

    if (user.is_blocked) {
      throw new UnauthorizedException({
        code: 'USER_BLOCKED',
        message: 'Your account has been suspended.',
      });
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect login username or password.',
      });
    }

    const tokens = await this.generateTokens(user.id, user.role, { login: user.login || undefined });

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        phone: user.phone,
        role: user.role,
        language: user.language,
        must_change_password: user.must_change_password,
        shopId: user.shops.length > 0 ? user.shops[0].id : null,
        shop: user.shops.length > 0 ? user.shops[0] : null,
      },
    };
  }

  /**
   * Exchanges a refresh token for a new access + refresh token pair, rotating
   * (revoking the old DB-persisted token and issuing a new one) so a stolen
   * refresh token can be invalidated and cannot be replayed after rotation.
   */
  async refreshToken(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });

    if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid, expired or revoked refresh token. Please log in again.',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.user_id } });
    if (!user || user.is_blocked) {
      throw new UnauthorizedException({
        code: 'USER_BLOCKED',
        message: 'User no longer active or suspended.',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked_at: new Date() },
    });

    return this.generateTokens(user.id, user.role, {
      phone: user.phone || undefined,
      login: user.login || undefined,
    });
  }

  /**
   * Revokes a single refresh token (logout on this device).
   */
  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { success: true };
  }

  /**
   * Revokes every refresh token belonging to the user (logout on all devices).
   */
  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password_hash) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!isMatch) {
      throw new BadRequestException({
        code: 'INCORRECT_CURRENT_PASSWORD',
        message: 'The current password you provided is incorrect.',
      });
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newHash,
        must_change_password: false,
      },
    });

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }

  /**
   * Issues a short-lived JWT access token plus an opaque, DB-persisted refresh
   * token (only its SHA-256 hash is stored, so a DB leak can't be replayed).
   */
  private async generateTokens(userId: string, role: string, extra: Record<string, any> = {}) {
    const payload = { sub: userId, role, ...extra };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET', 'super-secret-jwt-access-key-minimum-32-chars-long');
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    });

    const refreshToken = randomBytes(32).toString('hex');
    const ttlDays = this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', REFRESH_TOKEN_TTL_DAYS);
    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: hashToken(refreshToken),
        expires_at: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60, // 15 mins in seconds
    };
  }
}
