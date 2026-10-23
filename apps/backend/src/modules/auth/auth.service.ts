import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getJwtAccessSecret } from '../../common/config/jwt-secret';
import { ISmsService, SMS_SERVICE } from '../sms/sms.interface';
import { SendCodeDto, VerifyCodeDto, LoginDto, ChangePasswordDto } from './auth.dto';
import { REFRESH_TOKEN_TTL_DAYS, UserRole } from '@localshop/shared';

/** Per-phone SMS abuse limits (the per-IP limits live on the controller via @Throttle). */
export const SMS_RESEND_COOLDOWN_MS = 30 * 1000;
export const SMS_HOURLY_WINDOW_MS = 60 * 60 * 1000;
export const SMS_MAX_PER_PHONE_PER_HOUR = 5;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compared against when the login is unknown (or has no password) so a failed
 * login costs the same bcrypt work either way - otherwise the fast "no such
 * user" path lets an attacker enumerate valid logins by response time.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 10);

/** Fallback for `expiresIn` only when the signed token carries no `exp` (never the case with jsonwebtoken). */
const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
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
    const now = Date.now();
    const hourAgo = new Date(now - SMS_HOURLY_WINDOW_MS);

    // 1) Short cooldown: a code was sent to this phone within the last 30 seconds.
    const existing = await this.prisma.smsCode.findFirst({
      where: {
        phone,
        created_at: { gte: new Date(now - SMS_RESEND_COOLDOWN_MS) },
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Please wait at least 30 seconds before requesting another SMS code.',
      });
    }

    // 2) Rolling-hour cap per phone. Counted BEFORE any cleanup so the history
    //    of codes issued in the last hour is preserved (see the pruning below).
    const sentLastHour = await this.prisma.smsCode.count({
      where: { phone, created_at: { gte: hourAgo } },
    });

    if (sentLastHour >= SMS_MAX_PER_PHONE_PER_HOUR) {
      throw new HttpException(
        {
          code: 'SMS_HOURLY_LIMIT',
          message: `Too many verification codes requested for this phone. Limit is ${SMS_MAX_PER_PHONE_PER_HOUR} per hour; please try again later.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // The fixed dev code exists ONLY outside production with the mock provider.
    // Production is always a CSPRNG code (validateEnv also refuses SMS_PROVIDER=mock there).
    const isProduction = process.env.NODE_ENV === 'production';
    const useFixedDevCode = !isProduction && this.configService.get<string>('SMS_PROVIDER', 'mock') !== 'eskiz';
    const code = useFixedDevCode ? '123456' : randomInt(0, 1_000_000).toString().padStart(6, '0');

    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(now + 2 * 60 * 1000); // 2 minutes

    // Prune only codes that fell out of the rolling hour; rows inside the window
    // stay so the hourly count above cannot be reset by simply requesting again.
    // verifyCode() always picks the newest row, so older rows are never usable.
    await this.prisma.smsCode.deleteMany({
      where: { phone, created_at: { lt: hourAgo } },
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
    const sent = await this.smsService.sendSms(phone, smsMessage);
    if (!sent) {
      // The code row stays (it expires in 2 minutes) but the client must not be told
      // a message is on its way when the gateway refused or is not configured.
      this.logger.error(`SMS delivery failed for ${phone.slice(0, 7)}******; verification code not delivered.`);
      throw new HttpException(
        { code: 'SMS_DELIVERY_FAILED', message: 'Could not send the verification SMS. Please try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

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

    // The OTP is a customer-only credential. Staff accounts (seller/admin) carry a
    // phone too, but must authenticate with login + password - otherwise whoever
    // holds the shop's SIM owns the shop.
    if (user && user.role !== UserRole.CUSTOMER) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'This phone number belongs to a staff account. Please sign in with your login and password.',
      });
    }

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

    const tokens = await this.generateTokens(user.id, user.role);

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

    // Always pay for exactly one bcrypt.compare, whether or not the login exists,
    // so timing cannot reveal which logins are valid.
    const isPasswordValid = await bcrypt.compare(dto.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.password_hash || !isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect login username or password.',
      });
    }

    // Only after the password is proven: a blocked account must not be detectable without it.
    if (user.is_blocked) {
      throw new UnauthorizedException({
        code: 'USER_BLOCKED',
        message: 'Your account has been suspended.',
      });
    }

    const tokens = await this.generateTokens(user.id, user.role);

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

    if (stored?.revoked_at) {
      // Reuse detection: a rotated-away (or logged-out) token is being presented
      // again, so either the legitimate client or a thief holds a stale copy.
      // Whoever it is, the whole token family is burnt.
      this.logger.warn(`Refresh token reuse detected for user ${stored.user_id}; revoking all sessions`);
      await this.logoutAll(stored.user_id);
    }

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

    return this.generateTokens(user.id, user.role);
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
    // Atomically: new password + every existing session (refresh token) revoked,
    // so a stolen refresh token dies with the old password.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password_hash: newHash,
          must_change_password: false,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    // Fresh pair for the device that changed the password so it stays signed in.
    const tokens = await this.generateTokens(user.id, user.role);

    return {
      success: true,
      message: 'Password changed successfully.',
      ...tokens,
    };
  }

  /**
   * Issues a short-lived JWT access token plus an opaque, DB-persisted refresh
   * token (only its SHA-256 hash is stored, so a DB leak can't be replayed).
   * The JWT carries only `{ sub, role }` - never phone/login (PII in a bearer token).
   */
  private async generateTokens(userId: string, role: string): Promise<TokenPair> {
    const payload = { sub: userId, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: getJwtAccessSecret(this.configService),
      algorithm: 'HS256',
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
      expiresIn: this.accessTokenTtlSeconds(accessToken),
    };
  }

  /** Reads the lifetime off the signed token so it always matches JWT_ACCESS_EXPIRATION. */
  private accessTokenTtlSeconds(accessToken: string): number {
    const decoded = this.jwtService.decode(accessToken) as { exp?: number; iat?: number } | null;
    if (!decoded || typeof decoded.exp !== 'number') return DEFAULT_ACCESS_TTL_SECONDS;
    const issuedAt = typeof decoded.iat === 'number' ? decoded.iat : Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - issuedAt);
  }
}
