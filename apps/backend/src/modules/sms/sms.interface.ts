export interface ISmsService {
  sendSms(phone: string, text: string): Promise<boolean>;
}

export const SMS_SERVICE = 'SMS_SERVICE';
