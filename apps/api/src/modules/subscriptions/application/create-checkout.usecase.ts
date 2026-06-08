import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGateway, SubPlan, PAYMENT_GATEWAY, STRIPE_GATEWAY, HOTMART_GATEWAY, CAKTO_GATEWAY,
} from '../domain/payment-gateway';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/subscription.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { providerForCurrency, DEFAULT_CURRENCY } from '../domain/pricing';

@Injectable()
export class CreateCheckoutUseCase {
  private readonly logger = new Logger(CreateCheckoutUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly mp: PaymentGateway,
    @Inject(STRIPE_GATEWAY) private readonly stripe: PaymentGateway,
    @Inject(HOTMART_GATEWAY) private readonly hotmart: PaymentGateway,
    @Inject(CAKTO_GATEWAY) private readonly cakto: PaymentGateway,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  /** Gateway BR selecionável via env BR_BILLING_PROVIDER (default: mercadopago). */
  private brGateway(): PaymentGateway {
    const provider = (this.cfg.get<string>('BR_BILLING_PROVIDER') ?? 'mercadopago').toLowerCase();
    switch (provider) {
      case 'hotmart': return this.hotmart;
      case 'cakto': return this.cakto;
      case 'mercadopago': return this.mp;
      default:
        this.logger.warn(`BR_BILLING_PROVIDER="${provider}" desconhecido — usando mercadopago`);
        return this.mp;
    }
  }

  /**
   * Escolhe o gateway pela moeda: BRL -> provider BR (mp/hotmart/cakto via env),
   * demais -> Stripe. Sem misturar: cada moeda usa um único provider.
   */
  private gatewayForCurrency(currency: string): PaymentGateway {
    return providerForCurrency(currency) === 'stripe' ? this.stripe : this.brGateway();
  }

  /** Infere o gateway que criou uma assinatura existente pelo formato do id. */
  private gatewayForId(id: string): PaymentGateway {
    if (id.startsWith('sub_') || id.startsWith('cs_')) return this.stripe;
    if (id.startsWith('hotmart-')) return this.hotmart;
    if (id.startsWith('cakto-')) return this.cakto;
    return this.mp;
  }

  async execute(input: { userId: string; email: string; plan: SubPlan; currency?: string; locale?: string }): Promise<{ initPoint: string }> {
    const currency = (input.currency || DEFAULT_CURRENCY).toUpperCase();

    // Owner sempre Premium grátis — nunca cobra
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { isOwner: true },
    });
    if (user?.isOwner) {
      throw new ForbiddenException('OWNER_NEVER_CHARGED: você é dono do app, premium vitalício');
    }

    // Se já existe subscription pending do mesmo user, cancela antes de criar nova
    const existing = await this.subs.findByUserId(input.userId);
    if (existing && existing.status === 'pending') {
      try {
        await this.gatewayForId(existing.mpPreapprovalId).cancel(existing.mpPreapprovalId);
        this.logger.log(`Cancelled pending sub ${existing.mpPreapprovalId} before new checkout`);
      } catch (e) {
        // não bloqueia novo checkout se cancel falhar
        this.logger.warn(`Could not cancel pending sub: ${(e as Error).message}`);
      }
      await this.subs.markCancelled(existing.mpPreapprovalId);
    }

    const gateway = this.gatewayForCurrency(currency);
    const checkout = await gateway.createCheckout({ ...input, currency });
    await this.subs.upsertByMpId({
      userId: input.userId,
      mpPreapprovalId: checkout.preapprovalId,
      plan: input.plan,
      status: 'pending',
    });
    return { initPoint: checkout.initPoint };
  }
}
