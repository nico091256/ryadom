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

const ESKIZ_BASE_URL = 'https://notify.eskiz.uz/api';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // Refresh token every 24h

@Injectable()
export class SmsEskizService implements ISmsService {
  private readonly logger = new Logger(SmsEskizService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  private async getBearerToken(forceRefresh = false): Promise<string | null> {
    if (!forceRefresh && this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const email = this.env.ESKIZ_EMAIL;
    const password = this.env.ESKIZ_PASSWORD;
    if (!email || !password) return null;

    const response = await fetch(`${ESKIZ_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      this.logger.error(`[Eskiz.uz SMS] Auth failed with HTTP ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { data?: { token?: string } };
    const token = body?.data?.token || null;
    if (token) {
      this.cachedToken = token;
      this.tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    }
    return token;
  }

  async sendSms(phone: string, text: string): Promise<boolean> {
    // The text carries the OTP: log only a masked phone and the length, never the body.
    this.logger.log(`[Eskiz.uz SMS] -> ${maskPhone(phone)} (${text.length} chars)`);

    if (!this.env.ESKIZ_EMAIL || !this.env.ESKIZ_PASSWORD) {
      this.logger.warn('[Eskiz.uz SMS] ESKIZ_EMAIL / ESKIZ_PASSWORD are not set; SMS was NOT sent.');
      return false;
    }

    try {
      let token = await this.getBearerToken();
      if (!token) return false;

      const mobilePhone = String(phone).replace(/^\+/, '');
      const from = this.env.ESKIZ_FROM || '4546';

      let response = await fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mobile_phone: mobilePhone,
          message: text,
          from,
        }),
      });

      if (response.status === 401) {
        token = await this.getBearerToken(true);
        if (!token) return false;
        response = await fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mobile_phone: mobilePhone,
            message: text,
            from,
          }),
        });
      }

      if (!response.ok) {
        this.logger.error(`[Eskiz.uz SMS] Send failed with HTTP ${response.status}`);
        return false;
      }

      return true;
    } catch (err: any) {
      this.logger.error(`[Eskiz.uz SMS] Request error: ${err?.message || 'unknown'}`);
      return false;
    }
  }
}
