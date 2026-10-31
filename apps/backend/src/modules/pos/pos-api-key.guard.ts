import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { POS_API_KEY_HEADER } from './pos.constants';

/**
 * Authenticates cash-register software by the shop's POS API key
 * (`X-API-Key: rk_pos_...`). Routes using it are `@Public()` for the JWT guard;
 * this guard then resolves the shop and attaches it as `req.posShop`.
 */
@Injectable()
export class PosApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const key = PosApiKeyGuard.readKey(req.headers);

    if (!key) {
      throw new UnauthorizedException({
        code: 'POS_API_KEY_REQUIRED',
        message: `Missing POS API key. Send it in the ${POS_API_KEY_HEADER} header.`,
      });
    }

    const shop = await this.prisma.shop.findUnique({ where: { pos_api_key: key } });
    if (!shop) {
      throw new UnauthorizedException({ code: 'POS_API_KEY_INVALID', message: 'Unknown or revoked POS API key.' });
    }
    if (!shop.is_active || shop.status !== 'active') {
      throw new ForbiddenException({ code: 'SHOP_INACTIVE', message: 'This shop is not active on the platform.' });
    }

    req.posShop = shop;
    return true;
  }

  /** `X-API-Key: <key>` or `Authorization: ApiKey <key>` (some POS HTTP clients only allow the latter). */
  static readKey(headers: Record<string, unknown>): string {
    const direct = headers[POS_API_KEY_HEADER];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const auth = headers.authorization;
    if (typeof auth === 'string') {
      const m = /^ApiKey\s+(\S+)$/i.exec(auth.trim());
      if (m) return m[1];
    }
    return '';
  }
}

/** The shop resolved by PosApiKeyGuard. */
export const PosShop = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().posShop;
});
