import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY, PaymentGateway, ProviderEvent } from '../domain/payment-gateway';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/subscription.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvalidWebhookSignatureError } from '../../../shared/errors/domain-error';

/** Status que liberam o premium (MP usa "authorized", Stripe usa "active"/"trialing"). */
const ACTIVE_STATUSES = new Set(['authorized', 'active', 'trialing']);

@Injectable()
export class HandleWebhookUseCase {
  private readonly logger = new Logger(HandleWebhookUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Processa um webhook de assinatura.
   * @param opts.gateway gateway específico (ex.: Stripe). Default: o gateway injetado (Mercado Pago).
   * @param opts.provider nome do provider p/ idempotência. Default: gateway.name.
   */
  async execute(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    opts: { gateway?: PaymentGateway; provider?: string } = {},
  ): Promise<{ ok: true }> {
    const gateway = opts.gateway ?? this.gateway;
    const provider = opts.provider ?? gateway.name ?? 'mercadopago';

    let event: ProviderEvent;
    if (gateway.parseSignedEvent) {
      // Stripe: verifica assinatura E parseia o evento a partir do raw body.
      const parsed = await gateway.parseSignedEvent(rawBody, headers);
      if (!parsed) throw new InvalidWebhookSignatureError();
      event = parsed;
    } else {
      if (!gateway.verifyWebhook(rawBody, headers)) {
        throw new InvalidWebhookSignatureError();
      }
      event = await gateway.parseEvent(JSON.parse(rawBody.toString('utf8')));
    }

    let payload: unknown = null;
    try { payload = JSON.parse(rawBody.toString('utf8')); } catch { /* raw não-JSON, ok */ }

    // Idempotência: skip se já processado
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_externalId: { provider, externalId: event.externalId } },
    });
    if (existing?.processedAt) {
      this.logger.log(`Webhook ${provider}:${event.externalId} já processado, skip`);
      return { ok: true };
    }
    await this.prisma.webhookEvent.upsert({
      where: { provider_externalId: { provider, externalId: event.externalId } },
      create: { provider, externalId: event.externalId, payload: payload as any },
      update: { payload: payload as any },
    });

    if (event.type === 'subscription.updated' && event.subscription) {
      const sub = event.subscription;
      const isActive = ACTIVE_STATUSES.has(sub.status);
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
      where: { provider_externalId: { provider, externalId: event.externalId } },
      data: { processedAt: new Date() },
    });
    return { ok: true };
  }
}
