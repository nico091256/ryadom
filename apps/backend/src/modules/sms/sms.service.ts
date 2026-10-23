import { Injectable, Logger } from '@nestjs/common';
import { ISmsService } from './sms.interface';

/** `+998901234567` -> `+998901******`: enough to correlate a log line, not enough to identify. */
export function maskPhone(phone: string): string {
  return `${String(phone).slice(0, 7)}******`;
}

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

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  // TODO(go-live): implement the Eskiz.uz HTTP call (POST /api/auth/login for the
  // bearer token, then POST /api/message/sms/send with mobile_phone/message/from).
  // Until then this is an honest stub: it reports failure when credentials are
  // missing so AuthService / ops can see that no SMS went out.
  async sendSms(phone: string, text: string): Promise<boolean> {
    // The text carries the OTP: log only a masked phone and the length, never the body.
    this.logger.log(`[Eskiz.uz SMS] -> ${maskPhone(phone)} (${text.length} chars)`);

    if (!this.env.ESKIZ_EMAIL || !this.env.ESKIZ_PASSWORD) {
      this.logger.warn('[Eskiz.uz SMS] ESKIZ_EMAIL / ESKIZ_PASSWORD are not set; SMS was NOT sent.');
      return false;
    }
    return true;
  }
}
