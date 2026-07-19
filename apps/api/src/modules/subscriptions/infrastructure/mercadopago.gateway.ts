import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import * as crypto from 'crypto';
import {
  PaymentGateway, CreateCheckoutInput, CheckoutResult, ProviderEvent, SubPlan,
} from '../domain/payment-gateway';

/**
 * Adapter Mercado Pago.
 * Autenticação 100% via API key (MP_ACCESS_TOKEN) - NUNCA OAuth.
 */
@Injectable()
export class MercadoPagoGateway implements PaymentGateway {
  readonly name = 'mercadopago' as const;
  private readonly logger = new Logger(MercadoPagoGateway.name);
  private readonly client: MercadoPagoConfig;
  private readonly preapproval: PreApproval;

  constructor(private readonly cfg: ConfigService) {
    const accessToken = cfg.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN is required');
    this.client = new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
    this.preapproval = new PreApproval(this.client);
  }

  private planConfig(plan: SubPlan): { amount: number; frequency: number; frequency_type: 'months'; reason: string } {
    if (plan === 'MONTHLY') {
      return { amount: 19.90, frequency: 1, frequency_type: 'months', reason: 'RunQuest Premium Mensal' };
    }
    return { amount: 99.90, frequency: 12, frequency_type: 'months', reason: 'RunQuest Premium Anual' };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const cfg = this.planConfig(input.plan);
    // Fluxo "checkout pro" — cria preapproval pendente que abre fluxo de cartão na URL do MP.
    // NÃO usar preapproval_plan_id direto (esse exige card_token_id pré-tokenizado).
    const result = await this.preapproval.create({
      body: {
        reason: cfg.reason,
        external_reference: input.userId,
        payer_email: input.email,
        auto_recurring: {
          frequency: cfg.frequency,
          frequency_type: cfg.frequency_type,
          transaction_amount: cfg.amount,
          currency_id: 'BRL',
          free_trial: { frequency: 7, frequency_type: 'days' },
        } as any,
        back_url: this.cfg.get<string>('MP_BACK_URL')!,
        status: 'pending',
      } as any,
    });
    if (!result.id || !result.init_point) throw new Error('MP did not return id/init_point');
    return { preapprovalId: result.id, initPoint: result.init_point };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const secret = this.cfg.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('MP_WEBHOOK_SECRET not configured — accepting webhook without verification (DEV ONLY)');
      return this.cfg.get('NODE_ENV') !== 'production';
    }
    const sigHeader = headers['x-signature'];
    const requestId = headers['x-request-id'];
    if (!sigHeader || typeof sigHeader !== 'string') return false;

    // Parse "ts=...,v1=..."
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.trim().split('=')));
    const ts = parts['ts']; const v1 = parts['v1'];
    if (!ts || !v1) return false;

    let bodyJson: { data?: { id?: string } };
    try { bodyJson = JSON.parse(rawBody.toString('utf8')); } catch { return false; }
    const id = bodyJson?.data?.id;
    if (!id) return false;

    const manifest = `id:${id};request-id:${requestId ?? ''};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    // timingSafeEqual LANÇA RangeError se os tamanhos diferem — e o v1 vem do
    // request. Sem esta guarda, um v1 malformado derrubava o webhook com 500 em
    // vez de rejeitar (como Hotmart/Cakto já fazem).
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  async parseEvent(payload: unknown): Promise<ProviderEvent> {
    const p = payload as { type?: string; action?: string; data?: { id?: string } };
    const externalId = p.data?.id ?? 'unknown';
    if (p.type === 'subscription_preapproval' || p.action?.startsWith('updated')) {
      const detail = (await this.preapproval.get({ id: externalId })) as any;
      const status = detail.status ?? 'unknown';
      const plan = this.matchPlanFromMp(detail.preapproval_plan_id);
      return {
        type: 'subscription.updated',
        externalId,
        subscription: {
          mpPreapprovalId: detail.id as string,
          userId: detail.external_reference as string,
          status,
          plan,
          nextPaymentAt: detail.next_payment_date ? new Date(detail.next_payment_date) : null,
        },
      };
    }
    return { type: 'ignored', externalId };
  }

  async cancel(mpPreapprovalId: string): Promise<void> {
    await this.preapproval.update({ id: mpPreapprovalId, body: { status: 'cancelled' } });
  }

  private matchPlanFromMp(mpPlanId?: string | null): SubPlan | undefined {
    if (!mpPlanId) return undefined;
    if (mpPlanId === this.cfg.get('MP_PLAN_MONTHLY_ID')) return 'MONTHLY';
    if (mpPlanId === this.cfg.get('MP_PLAN_YEARLY_ID')) return 'YEARLY';
    return undefined;
  }
}
