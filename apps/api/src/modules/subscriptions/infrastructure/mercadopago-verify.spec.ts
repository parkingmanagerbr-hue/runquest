import * as crypto from 'crypto';
import { MercadoPagoGateway } from './mercadopago.gateway';

/**
 * Verificação de assinatura do webhook do Mercado Pago. O módulo não tinha spec.
 * Foco no bug: `timingSafeEqual` LANÇA se os buffers têm tamanhos diferentes, e o
 * `v1` vem do request — um v1 malformado derrubava o webhook com 500 em vez de
 * rejeitar. (Hotmart/Cakto já guardavam o tamanho; o MP não.)
 */
const SECRET = 'test-webhook-secret';

function makeGateway() {
  const cfg: any = {
    get: (k: string) => ({
      MP_ACCESS_TOKEN: 'fake-access-token',
      MP_WEBHOOK_SECRET: SECRET,
      NODE_ENV: 'production',
    } as Record<string, string>)[k],
  };
  return new MercadoPagoGateway(cfg);
}

function sign(id: string, requestId: string, ts: string): string {
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  return crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
}

const body = (id: string) => Buffer.from(JSON.stringify({ data: { id } }));

describe('MercadoPagoGateway.verifyWebhook', () => {
  const gw = makeGateway();

  it('assinatura válida → true', () => {
    const v1 = sign('12345', 'req-1', '1700000000');
    const ok = gw.verifyWebhook(body('12345'), {
      'x-signature': `ts=1700000000,v1=${v1}`,
      'x-request-id': 'req-1',
    });
    expect(ok).toBe(true);
  });

  it('v1 malformado (tamanho diferente) → false, NÃO lança (era 500)', () => {
    expect(() =>
      gw.verifyWebhook(body('12345'), {
        'x-signature': 'ts=1700000000,v1=deadbeef', // curto demais p/ um sha256
        'x-request-id': 'req-1',
      }),
    ).not.toThrow();
    expect(
      gw.verifyWebhook(body('12345'), {
        'x-signature': 'ts=1700000000,v1=deadbeef',
        'x-request-id': 'req-1',
      }),
    ).toBe(false);
  });

  it('assinatura de OUTRO corpo → false', () => {
    const v1 = sign('99999', 'req-1', '1700000000'); // assinou outro id
    expect(gw.verifyWebhook(body('12345'), {
      'x-signature': `ts=1700000000,v1=${v1}`,
      'x-request-id': 'req-1',
    })).toBe(false);
  });

  it('header x-signature ausente → false', () => {
    expect(gw.verifyWebhook(body('12345'), { 'x-request-id': 'req-1' })).toBe(false);
  });

  it('corpo sem data.id → false', () => {
    const v1 = sign('12345', 'req-1', '1700000000');
    expect(gw.verifyWebhook(Buffer.from('{}'), {
      'x-signature': `ts=1700000000,v1=${v1}`,
      'x-request-id': 'req-1',
    })).toBe(false);
  });
});
