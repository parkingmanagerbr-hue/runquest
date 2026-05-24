import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const key = 'a'.repeat(64); // 32 bytes hex
  const cfg = { get: (k: string) => (k === 'TOKEN_ENCRYPTION_KEY' ? key : undefined) } as unknown as ConfigService;

  it('cifra e decifra round-trip', () => {
    const svc = new CryptoService(cfg);
    const enc = svc.encrypt('hello-world-token-123');
    expect(enc).not.toBe('hello-world-token-123');
    expect(svc.decrypt(enc)).toBe('hello-world-token-123');
  });

  it('rejeita chave com tamanho errado', () => {
    const bad = { get: () => 'short' } as unknown as ConfigService;
    expect(() => new CryptoService(bad)).toThrow();
  });

  it('produz outputs distintos para mesma entrada (IV aleatório)', () => {
    const svc = new CryptoService(cfg);
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
    expect(svc.decrypt(a)).toBe('same');
    expect(svc.decrypt(b)).toBe('same');
  });
});
