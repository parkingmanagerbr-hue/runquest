import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM symmetric encryption for sensitive at-rest data (tokens de terceiros).
 * Key vem de ENV `TOKEN_ENCRYPTION_KEY` (32 bytes hex = 64 chars).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(cfg: ConfigService) {
    const raw = cfg.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('TOKEN_ENCRYPTION_KEY required (32 bytes hex)');
    }
    this.key = Buffer.from(raw, 'hex');
    if (this.key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes hex (64 chars)');
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, enc, tag]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const enc = buf.subarray(12, buf.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }
}
