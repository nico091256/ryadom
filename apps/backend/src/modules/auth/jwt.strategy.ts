import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getJwtAccessSecret } from '../../common/config/jwt-secret';

/** Access-token claims. Deliberately minimal: no phone/login (PII) in a bearer token. */
export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtAccessSecret(configService),
      // Pin the algorithm: a token signed with anything else (incl. "none") is rejected outright.
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        shops: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'User belonging to token no longer exists.',
      });
    }

    if (user.is_blocked) {
      throw new UnauthorizedException({
        code: 'USER_BLOCKED',
        message: 'Account is blocked.',
      });
    }

    return {
      id: user.id,
      phone: user.phone,
      login: user.login,
      name: user.name,
      role: user.role,
      language: user.language,
      is_blocked: user.is_blocked,
      must_change_password: user.must_change_password,
      shopId: user.shops.length > 0 ? user.shops[0].id : null,
    };
  }
}
