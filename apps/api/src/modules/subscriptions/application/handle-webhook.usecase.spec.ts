import { HandleWebhookUseCase } from './handle-webhook.usecase';
import { PaymentGateway, ProviderEvent } from '../domain/payment-gateway';
import { SubscriptionRepository } from '../domain/subscription.repository';
import { InvalidWebhookSignatureError } from '../../../shared/errors/domain-error';

const makeGateway = (overrides: Partial<PaymentGateway> = {}): PaymentGateway => ({
  name: 'mercadopago' as const,
  createCheckout: jest.fn(),
  verifyWebhook: jest.fn().mockReturnValue(true),
  parseEvent: jest.fn(),
  cancel: jest.fn(),
  ...overrides,
});
const makeSubs = (): jest.Mocked<SubscriptionRepository> => ({
  upsertByMpId: jest.fn(),
  findByMpId: jest.fn(),
  findByUserId: jest.fn(),
  updateStatus: jest.fn(),
  markCancelled: jest.fn(),
});
const makePrisma = () => ({
  webhookEvent: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  user: { update: jest.fn() },
}) as any;

describe('HandleWebhookUseCase', () => {
  it('rejeita assinatura inválida', async () => {
    const gw = makeGateway({ verifyWebhook: jest.fn().mockReturnValue(false) });
    const uc = new HandleWebhookUseCase(gw, makeSubs(), makePrisma());
    await expect(uc.execute(Buffer.from('{}'), {})).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
  });

  it('ativa premium quando subscription.updated -> authorized', async () => {
    const subs = makeSubs();
    const prisma = makePrisma();
    const event: ProviderEvent = {
      type: 'subscription.updated',
      externalId: 'mp-123',
      subscription: {
        mpPreapprovalId: 'mp-123', userId: 'user-1',
        status: 'authorized', plan: 'MONTHLY',
        nextPaymentAt: new Date('2026-06-23'),
      },
    };
    const gw = makeGateway({ parseEvent: jest.fn().mockResolvedValue(event) });
    const uc = new HandleWebhookUseCase(gw, subs, prisma);

    await uc.execute(Buffer.from(JSON.stringify({ data: { id: 'mp-123' } })), {});

    expect(subs.upsertByMpId).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', mpPreapprovalId: 'mp-123', status: 'authorized',
    }));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.objectContaining({ isPremium: true }),
    }));
  });

  it('é idempotente: ignora eventos já processados', async () => {
    const subs = makeSubs();
    const prisma = makePrisma();
    prisma.webhookEvent.findUnique.mockResolvedValue({ processedAt: new Date() });
    const gw = makeGateway({
      parseEvent: jest.fn().mockResolvedValue({ type: 'ignored', externalId: 'dup-1' } as ProviderEvent),
    });
    const uc = new HandleWebhookUseCase(gw, subs, prisma);
    await uc.execute(Buffer.from(JSON.stringify({ data: { id: 'dup-1' } })), {});
    expect(subs.upsertByMpId).not.toHaveBeenCalled();
  });
});
