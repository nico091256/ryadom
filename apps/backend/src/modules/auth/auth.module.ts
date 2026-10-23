import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenJanitor } from './refresh-token.janitor';
import { SmsModule } from '../sms/sms.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { getJwtAccessSecret } from '../../common/config/jwt-secret';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: getJwtAccessSecret(config),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    SmsModule,
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenJanitor],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
