import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';

/**
 * Thin wrapper around the Firebase Admin SDK for FCM push delivery.
 * No-ops (logs only) until a service account is configured via
 * FIREBASE_SERVICE_ACCOUNT_JSON (raw or base64-encoded JSON) or
 * FIREBASE_SERVICE_ACCOUNT_PATH (path to the credentials file) — matches the
 * existing dev-without-credentials experience the Expo push code had.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0];
      return;
    }

    const credential = this.loadCredential();
    if (!credential) {
      this.logger.warn(
        'No Firebase service account configured (FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH). FCM push notifications will be logged only.',
      );
      return;
    }

    try {
      this.app = admin.initializeApp({ credential: admin.credential.cert(credential) });
      this.logger.log('Firebase Admin SDK initialized for FCM push delivery.');
    } catch (err: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err.message}`);
    }
  }

  private loadCredential(): admin.ServiceAccount | null {
    const inlineJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    const path = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

    try {
      if (inlineJson) {
        const raw = inlineJson.trim().startsWith('{')
          ? inlineJson
          : Buffer.from(inlineJson, 'base64').toString('utf8');
        return JSON.parse(raw);
      }
      if (path) {
        return JSON.parse(readFileSync(path, 'utf8'));
      }
    } catch (err: any) {
      this.logger.error(`Failed to parse Firebase service account credentials: ${err.message}`);
    }
    return null;
  }

  isConfigured(): boolean {
    return this.app !== null;
  }

  get messaging(): admin.messaging.Messaging | null {
    return this.app ? admin.messaging(this.app) : null;
  }
}
