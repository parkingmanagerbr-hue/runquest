import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY, PaymentGateway } from '../domain/payment-gateway';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/subscription.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvalidWebhookSignatureError } from '../../../shared/errors/domain-error';

@Injectable()
export class HandleWebhookUseCase {
  private readonly logger = new Logger(HandleWebhookUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<{ ok: true }> {
    if (!this.gateway.verifyWebhook(rawBody, headers)) {
      throw new InvalidWebhookSignatureError();
    }
    const payload = JSON.parse(rawBody.toString('utf8'));
    const event = await this.gateway.parseEvent(payload);

    // Idempotência: skip se já processado
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_externalId: { provider: 'mercadopago', externalId: event.externalId } },
    });
    if (existing?.processedAt) {
      this.logger.log(`Webhook ${event.externalId} já processado, skip`);
      return { ok: true };
    }
    await this.prisma.webhookEvent.upsert({
      where: { provider_externalId: { provider: 'mercadopago', externalId: event.externalId } },
      create: { provider: 'mercadopago', externalId: event.externalId, payload: payload as any },
      update: { payload: payload as any },
    });

    if (event.type === 'subscription.updated' && event.subscription) {
      const sub = event.subscription;
      const isActive = sub.status === 'authorized';
      await this.subs.upsertByMpId({
        userId: sub.userId,
        mpPreapprovalId: sub.mpPreapprovalId,
        plan: sub.plan ?? 'MONTHLY',
        status: sub.status,
        nextPaymentAt: sub.nextPaymentAt ?? null,
      });
      await this.prisma.user.update({
        where: { id: sub.userId },
        data: {
          isPremium: isActive,
          premiumUntil: isActive ? sub.nextPaymentAt ?? null : null,
        },
      });
    }

    await this.prisma.webhookEvent.update({
      where: { provider_externalId: { provider: 'mercadopago', externalId: event.externalId } },
      data: { processedAt: new Date() },
    });
    return { ok: true };
  }
}
