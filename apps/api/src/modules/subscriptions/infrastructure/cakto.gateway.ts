import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  PaymentGateway, CreateCheckoutInput, CheckoutResult, ProviderEvent, SubPlan,
} from '../domain/payment-gateway';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeEmail } from '../../../shared/kernel/normalize-email';

/**
 * Adapter Cakto — gateway BR de LINK HOSPEDADO (pay.cakto.com.br/{slug}).
 * Mesmo modelo do Hotmart: URL de oferta pré-configurada por plano em env,
 * mapeamento do usuário via param `ref` anexado e recuperado no webhook.
 *
 * Init preguiçoso: todas as envs do Cakto são OPCIONAIS — o app sobe
 * normalmente mesmo sem elas.
 */
@Injectable()
export class CaktoGateway implements PaymentGateway {
  readonly name = 'cakto' as const;
  private readonly logger = new Logger(CaktoGateway.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private appendParam(url: string, key: string, value: string): string {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${key}=${encodeURIComponent(value)}`;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const envKey = input.plan === 'MONTHLY' ? 'CAKTO_OFFER_MONTHLY_URL' : 'CAKTO_OFFER_YEARLY_URL';
    const base = this.cfg.get<string>(envKey);
    if (!base) {
      throw new Error(`${envKey} não configurada — checkout Cakto indisponível para o plano ${input.plan}`);
    }
    // `ref` é o parâmetro de tracking que recuperamos no webhook.
    const url = this.appendParam(base, 'ref', input.userId);
    return { preapprovalId: `cakto-${input.userId}`, initPoint: url };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const expected = this.cfg.get<string>('CAKTO_WEBHOOK_SECRET') ?? this.cfg.get<string>('CAKTO_TOKEN');
    if (!expected) {
      this.logger.warn('CAKTO_WEBHOOK_SECRET/CAKTO_TOKEN not configured — accepting webhook without verification (DEV ONLY)');
      return this.cfg.get('NODE_ENV') !== 'production';
    }

    // O Cakto inclui um token no corpo (`secret`/`token`) ou no header `x-cakto-signature`.
    let token: string | undefined;
    const headerSig = headers['x-cakto-signature'];
    if (typeof headerSig === 'string') {
      token = headerSig;
    } else {
      try {
        const body = JSON.parse(rawBody.toString('utf8')) as { secret?: string; token?: string };
        token = body?.secret ?? body?.token;
      } catch { /* corpo não-JSON */ }
    }
    if (!token) return false;

    try {
      const a = Buffer.from(token);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /** Recupera o `ref` (userId) ecoado em caminhos defensivos. */
  private extractTrackingUserId(data: any): string | undefined {
    return (
      data?.ref
      ?? data?.tracking?.ref
      ?? data?.metadata?.ref
      ?? data?.customer?.ref
      ?? undefined
    );
  }

  private matchPlanFromOfferCode(code?: string | null): SubPlan {
    if (code && code === this.cfg.get('CAKTO_OFFER_YEARLY_CODE')) return 'YEARLY';
    if (code && code === this.cfg.get('CAKTO_OFFER_MONTHLY_CODE')) return 'MONTHLY';
    return 'MONTHLY';
  }

  async parseEvent(payload: unknown): Promise<ProviderEvent> {
    const p = payload as {
      event?: string;
      data?: {
        id?: string;
        transaction?: string;
        status?: string;
        customer?: { email?: string };
        offer?: { code?: string };
        [k: string]: any;
      };
    };
    const data = p.data ?? {};
    const txId = data.id ?? data.transaction;
    const externalId =
      txId
      ?? crypto.createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex').slice(0, 32);

    let status: string;
    switch (p.event) {
      case 'purchase_approved':
      case 'subscription_renewed':
        status = 'active';
        break;
      case 'refund':
      case 'chargeback':
      case 'subscription_canceled':
        status = 'canceled';
        break;
      default:
        return { type: 'ignored', externalId };
    }

    let userId = this.extractTrackingUserId(data);
    if (!userId) {
      // Normaliza igual ao cadastro (trim + minúsculas) — ver normalizeEmail.
      const email = normalizeEmail(data.customer?.email);
      if (email) {
        const user = await this.prisma.user.findFirst({ where: { email }, select: { id: true } });
        userId = user?.id;
      }
    }
    if (!userId) {
      this.logger.warn(`Cakto webhook ${externalId} sem userId recuperável — ignorando`);
      return { type: 'ignored', externalId };
    }

    const plan = this.matchPlanFromOfferCode(data.offer?.code);

    return {
      type: 'subscription.updated',
      externalId,
      subscription: {
        mpPreapprovalId: txId ?? externalId,
        userId,
        status,
        plan,
        nextPaymentAt: null,
      },
    };
  }

  /**
   * O cancelamento de assinatura do Cakto deve ser gerenciado no painel do
   * Cakto. No-op com aviso aqui.
   */
  async cancel(id: string): Promise<void> {
    this.logger.warn(`Cancelamento Cakto de "${id}" deve ser feito no painel do Cakto. No-op.`);
  }
}
