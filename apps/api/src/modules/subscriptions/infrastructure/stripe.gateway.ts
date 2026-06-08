import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentGateway, CreateCheckoutInput, CheckoutResult, ProviderEvent,
} from '../domain/payment-gateway';
import { pricingForCurrency } from '../domain/pricing';

/** Locales suportados pelo Stripe Checkout — mapeia o idioma da UI p/ o set do Stripe. */
const STRIPE_LOCALES: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = {
  en: 'en', 'pt-BR': 'pt-BR', pt: 'pt-BR', es: 'es', fr: 'fr', de: 'de',
  it: 'it', nl: 'nl', pl: 'pl', ja: 'ja', zh: 'zh',
};

function stripeLocale(locale?: string): Stripe.Checkout.SessionCreateParams.Locale {
  if (!locale) return 'auto';
  return STRIPE_LOCALES[locale] ?? STRIPE_LOCALES[locale.split('-')[0]] ?? 'auto';
}

/**
 * Adapter Stripe — billing internacional multi-moeda.
 * Init preguiçoso: se STRIPE_SECRET_KEY não estiver configurada, o app
 * sobe normalmente (mercados BRL via Mercado Pago) e só falha se alguém
 * tentar um checkout em moeda internacional.
 */
@Injectable()
export class StripeGateway implements PaymentGateway {
  readonly name = 'stripe' as const;
  private readonly logger = new Logger(StripeGateway.name);
  private _client: Stripe | null = null;

  constructor(private readonly cfg: ConfigService) {}

  private client(): Stripe {
    if (this._client) return this._client;
    const key = this.cfg.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY não configurada — billing internacional indisponível');
    this._client = new Stripe(key);
    return this._client;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const pricing = pricingForCurrency(input.currency);
    const amount = input.plan === 'MONTHLY' ? pricing.monthly : pricing.yearly;
    const interval: 'month' | 'year' = input.plan === 'MONTHLY' ? 'month' : 'year';

    const successUrl = this.cfg.get<string>('STRIPE_SUCCESS_URL')
      ?? `${this.cfg.get<string>('APP_URL') ?? ''}/app?premium=success`;
    const cancelUrl = this.cfg.get<string>('STRIPE_CANCEL_URL')
      ?? `${this.cfg.get<string>('APP_URL') ?? ''}/pricing?canceled=1`;

    const session = await this.client().checkout.sessions.create({
      mode: 'subscription',
      customer_email: input.email,
      client_reference_id: input.userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pricing.currency.toLowerCase(),
            unit_amount: Math.round(amount * 100),
            recurring: { interval },
            product_data: {
              name: `RunQuest Premium (${input.plan === 'MONTHLY' ? 'Monthly' : 'Yearly'})`,
            },
          },
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId: input.userId, plan: input.plan },
      },
      metadata: { userId: input.userId, plan: input.plan },
      locale: stripeLocale(input.locale),
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.id || !session.url) throw new Error('Stripe não retornou id/url da sessão');
    return { preapprovalId: session.id, initPoint: session.url };
  }

  // Não usado p/ Stripe (usamos parseSignedEvent), mas exigido pela interface.
  verifyWebhook(): boolean {
    return false;
  }

  async parseEvent(): Promise<ProviderEvent> {
    return { type: 'ignored', externalId: 'unused' };
  }

  async parseSignedEvent(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<ProviderEvent | null> {
    const secret = this.cfg.get<string>('STRIPE_WEBHOOK_SECRET');
    const sig = headers['stripe-signature'];
    if (!secret || !sig || typeof sig !== 'string') {
      this.logger.warn('Stripe webhook sem assinatura/segredo configurado');
      return null;
    }

    let event: Stripe.Event;
    try {
      event = this.client().webhooks.constructEvent(rawBody, sig, secret);
    } catch (e) {
      this.logger.warn(`Assinatura Stripe inválida: ${(e as Error).message}`);
      return null;
    }

    const externalId = event.id;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? (session.metadata?.userId as string | undefined);
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (!userId || !subId) return { type: 'ignored', externalId };
        let nextPaymentAt: Date | null = null;
        let plan = (session.metadata?.plan as 'MONTHLY' | 'YEARLY' | undefined);
        try {
          const sub = await this.client().subscriptions.retrieve(subId);
          nextPaymentAt = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
          plan = (sub.metadata?.plan as 'MONTHLY' | 'YEARLY' | undefined) ?? plan;
        } catch { /* segue com o que temos */ }
        return {
          type: 'subscription.updated',
          externalId,
          subscription: { mpPreapprovalId: subId, userId, status: 'active', plan, nextPaymentAt },
        };
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId as string | undefined;
        if (!userId) return { type: 'ignored', externalId };
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
        return {
          type: 'subscription.updated',
          externalId,
          subscription: {
            mpPreapprovalId: sub.id,
            userId,
            status,
            plan: sub.metadata?.plan as 'MONTHLY' | 'YEARLY' | undefined,
            nextPaymentAt: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          },
        };
      }
      default:
        return { type: 'ignored', externalId };
    }
  }

  async cancel(subscriptionId: string): Promise<void> {
    await this.client().subscriptions.cancel(subscriptionId);
  }
}
