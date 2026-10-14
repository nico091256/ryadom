import { Injectable, Logger } from '@nestjs/common';
import { ISmsService } from './sms.interface';

@Injectable()
export class SmsMockService implements ISmsService {
  private readonly logger = new Logger(SmsMockService.name);

  async sendSms(phone: string, text: string): Promise<boolean> {
    this.logger.log(`\n========================================\n[SMS MOCK] To: ${phone}\nMessage: "${text}"\n(Verification Code for dev: 123456)\n========================================`);
    return true;
  }
}

@Injectable()
export class SmsEskizService implements ISmsService {
  private readonly logger = new Logger(SmsEskizService.name);

  async sendSms(phone: string, text: string): Promise<boolean> {
    this.logger.log(`[Eskiz.uz SMS] Sending to ${phone}: ${text}`);
    // Eskiz.uz API integration hook
    return true;
  }
}
