import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiHeader, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SendCodeDto, VerifyCodeDto, LoginDto, RefreshTokenDto, ChangePasswordDto } from './auth.dto';
import {
  clearRefreshCookie,
  readRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  wantsCookieTransport,
} from './refresh-cookie';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { REFRESH_TOKEN_TTL_DAYS, UserRole } from '@localshop/shared';
import { RolesGuard } from '../../common/guards/roles.guard';

/** Per-IP abuse windows for the unauthenticated auth endpoints (on top of the global 120/min). */
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const AUTH_THROTTLE = {
  sendCode: { limit: 5, ttl: FIFTEEN_MINUTES_MS },
  verify: { limit: 10, ttl: FIFTEEN_MINUTES_MS },
  login: { limit: 10, ttl: FIFTEEN_MINUTES_MS },
  refresh: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
} as const;

const MISSING_REFRESH_TOKEN = {
  code: 'INVALID_REFRESH_TOKEN',
  message: `Refresh token missing: send it in the JSON body or in the ${REFRESH_COOKIE_NAME} cookie.`,
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('send-code')
  @Throttle({ default: AUTH_THROTTLE.sendCode })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send SMS verification code to customer phone' })
  @ApiResponse({ status: 200, description: 'SMS code dispatched successfully' })
  @ApiResponse({ status: 429, description: 'Per-IP (5 / 15 min) or per-phone (5 / hour) limit reached' })
  async sendCode(@Body() dto: SendCodeDto) {
    return this.authService.sendCode(dto);
  }

  @Public()
  @Post('verify')
  @Throttle({ default: AUTH_THROTTLE.verify })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify SMS code and receive JWT tokens (auto-creates customer)' })
  @ApiResponse({ status: 200, description: 'Verified and authenticated' })
  async verify(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: AUTH_THROTTLE.login })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login for shopkeeper or platform admin with username & password' })
  @ApiHeader({
    name: 'X-Auth-Transport',
    required: false,
    description: `"cookie" => refresh token is set as the httpOnly ${REFRESH_COOKIE_NAME} cookie and omitted from the body (web panels)`,
  })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    if (!wantsCookieTransport(req)) return result;

    const { refreshToken, ...body } = result;
    setRefreshCookie(res, refreshToken, this.refreshTtlDays());
    return body;
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: AUTH_THROTTLE.refresh })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange refresh token for a new access token (rotates the refresh token)' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Missing, invalid, expired or revoked refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const fromBody = dto.refreshToken?.trim() || undefined;
    const fromCookie = readRefreshCookie(req);
    const token = fromBody || fromCookie; // body wins when both are present
    if (!token) throw new UnauthorizedException(MISSING_REFRESH_TOKEN);

    const viaCookie = !fromBody;
    let result: Awaited<ReturnType<AuthService['refreshToken']>>;
    try {
      result = await this.authService.refreshToken(token);
    } catch (err) {
      // A dead cookie would otherwise be replayed on every page load.
      if (viaCookie) clearRefreshCookie(res);
      throw err;
    }
    if (!viaCookie) return result;

    const { refreshToken, ...body } = result;
    setRefreshCookie(res, refreshToken, this.refreshTtlDays());
    return body;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a single refresh token (logout on this device)' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const fromBody = dto.refreshToken?.trim() || undefined;
    const fromCookie = readRefreshCookie(req);
    if (fromCookie || wantsCookieTransport(req)) clearRefreshCookie(res);

    const token = fromBody || fromCookie;
    if (!token) throw new UnauthorizedException(MISSING_REFRESH_TOKEN);
    return this.authService.logout(token);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Change password (mandatory on first seller login). Revokes every other session and returns a fresh token pair for this device.',
  })
  @ApiHeader({
    name: 'X-Auth-Transport',
    required: false,
    description: `"cookie" => the new refresh token is set as the httpOnly ${REFRESH_COOKIE_NAME} cookie and omitted from the body (web panels)`,
  })
  @ApiResponse({ status: 200, description: 'Password changed; new accessToken (+ refreshToken) issued' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(userId, dto);
    // The old cookie was just revoked server-side; a cookie client gets the rotated one.
    if (!wantsCookieTransport(req) && !readRefreshCookie(req)) return result;

    const { refreshToken, ...body } = result;
    setRefreshCookie(res, refreshToken, this.refreshTtlDays());
    return body;
  }

  private refreshTtlDays(): number {
    const raw = this.configService.get<string | number>('REFRESH_TOKEN_TTL_DAYS', REFRESH_TOKEN_TTL_DAYS);
    const days = Number(raw);
    return Number.isFinite(days) && days > 0 ? days : REFRESH_TOKEN_TTL_DAYS;
  }
}
