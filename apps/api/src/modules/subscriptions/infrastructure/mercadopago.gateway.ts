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
  private readonly logger = new Logger(MercadoPagoGateway.name);
  private readonly client: MercadoPagoConfig;
  private readonly preapproval: PreApproval;

  constructor(private readonly cfg: ConfigService) {
    const accessToken = cfg.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN is required');
    this.client = new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
    this.preapproval = new PreApproval(this.client);
  }

  private planId(plan: SubPlan): string {
    const id = plan === 'MONTHLY'
      ? this.cfg.get<string>('MP_PLAN_MONTHLY_ID')
      : this.cfg.get<string>('MP_PLAN_YEARLY_ID');
    if (!id) throw new Error(`Plan ID for ${plan} not configured`);
    return id;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const result = await this.preapproval.create({
      body: {
        preapproval_plan_id: this.planId(input.plan),
        payer_email: input.email,
        external_reference: input.userId,
        back_url: this.cfg.get<string>('MP_BACK_URL')!,
        status: 'pending',
      },
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
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  }

  async parseEvent(payload: unknown): Promise<ProviderEvent> {
    const p = payload as { type?: string; action?: string; data?: { id?: string } };
    const externalId = p.data?.id ?? 'unknown';
    if (p.type === 'subscription_preapproval' || p.action?.startsWith('updated')) {
      const detail = await this.preapproval.get({ id: externalId });
      const status = detail.status ?? 'unknown';
      const plan = this.matchPlanFromMp(detail.preapproval_plan_id);
      return {
        type: 'subscription.updated',
        externalId,
        subscription: {
          mpPreapprovalId: detail.id!,
          userId: detail.external_reference!,
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
