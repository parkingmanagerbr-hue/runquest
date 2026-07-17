import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PushSubDto } from './settings.module';

/**
 * O ValidationPipe global roda com `whitelist: true` + `forbidNonWhitelisted: true`
 * (main.ts): qualquer propriedade SEM decorator é rejeitada com 400. O front envia
 * `subscription.toJSON()` = { endpoint, expirationTime, keys: { p256dh, auth } }.
 * Como `keys` e `expirationTime` não tinham decorator, TODO push-subscribe
 * respondia 400 e nenhuma subscription era salva — o sistema de push inteiro
 * (kudos, comentários, resumo semanal) estava morto.
 */
const validateLikePipe = (payload: unknown) =>
  validate(plainToInstance(PushSubDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('PushSubDto — payload real do navegador', () => {
  // Exatamente o shape de PushSubscription.toJSON()
  const browserPayload = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    expirationTime: null,
    keys: { p256dh: 'BNc...chave', auth: 'aX9...auth' },
  };

  it('aceita o payload que o navegador realmente envia', async () => {
    await expect(validateLikePipe(browserPayload)).resolves.toEqual([]);
  });

  it('aceita expirationTime numérico (alguns navegadores mandam)', async () => {
    await expect(validateLikePipe({ ...browserPayload, expirationTime: 1893456000000 }))
      .resolves.toEqual([]);
  });

  it('rejeita endpoint ausente', async () => {
    const { endpoint, ...semEndpoint } = browserPayload;
    void endpoint;
    expect((await validateLikePipe(semEndpoint)).length).toBeGreaterThan(0);
  });

  it('rejeita keys sem p256dh/auth (subscription inutilizável)', async () => {
    expect((await validateLikePipe({ ...browserPayload, keys: {} })).length).toBeGreaterThan(0);
  });

  it('rejeita propriedade desconhecida (whitelist)', async () => {
    expect((await validateLikePipe({ ...browserPayload, hacker: 'x' })).length).toBeGreaterThan(0);
  });
});
