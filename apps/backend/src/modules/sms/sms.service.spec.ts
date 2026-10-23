import { Logger } from '@nestjs/common';
import { SmsEskizService, maskPhone } from './sms.service';

describe('SmsEskizService', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('maskPhone keeps the country code + 3 digits only', () => {
    expect(maskPhone('+998901234567')).toBe('+998901******');
  });

  it('never logs the OTP text or the full phone number', async () => {
    const service = new SmsEskizService({ ESKIZ_EMAIL: 'a@b.uz', ESKIZ_PASSWORD: 'secret' });
    const ok = await service.sendSms('+998901234567', 'LocalShop tasdiqlash kodi: 482913. Hech kimga bermang!');

    expect(ok).toBe(true);
    const logged = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('482913');
    expect(logged).not.toContain('+998901234567');
    expect(logged).toContain('+998901******');
  });

  it('returns false with a warning when Eskiz credentials are missing', async () => {
    const service = new SmsEskizService({});
    expect(await service.sendSms('+998901234567', 'code 123456')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ESKIZ_EMAIL'));
  });
});
