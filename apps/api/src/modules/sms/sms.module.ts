import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_SERVICE } from './sms.interface';
import { SmsMockService, SmsEskizService } from './sms.service';

@Module({
  providers: [
    {
      provide: SMS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('SMS_PROVIDER', 'mock');
        return provider === 'eskiz' ? new SmsEskizService() : new SmsMockService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
