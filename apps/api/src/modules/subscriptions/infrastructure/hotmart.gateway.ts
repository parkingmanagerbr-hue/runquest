import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  PaymentGateway, CreateCheckoutInput, CheckoutResult, ProviderEvent, SubPlan,
} from '../domain/payment-gateway';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeEmail } from '../../../shared/kernel/normalize-email';

/**
 * Adapter Hotmart — gateway BR de LINK HOSPEDADO (não cria sessão dinâmica
 * como MP/Stripe). O checkout é uma URL de oferta pré-configurada por plano,
 * definida em env. O mapeamento do usuário é feito anexando o userId como
 * parâmetro de tracking (`sck`) na URL, e recuperado no webhook.
 *
 * Init preguiçoso: todas as envs do Hotmart são OPCIONAIS — o app sobe
 * normalmente mesmo sem elas, falhando só se alguém tentar usar este gateway.
 */
@Injectable()
export class HotmartGateway implements PaymentGateway {
  readonly name = 'hotmart' as const;
  private readonly logger = new Logger(HotmartGateway.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Anexa um query param a uma URL tratando `?`/`&` corretamente. */
  private appendParam(url: string, key: string, value: string): string {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${key}=${encodeURIComponent(value)}`;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const envKey = input.plan === 'MONTHLY' ? 'HOTMART_OFFER_MONTHLY_URL' : 'HOTMART_OFFER_YEARLY_URL';
    const base = this.cfg.get<string>(envKey);
    if (!base) {
      throw new Error(`${envKey} não configurada — checkout Hotmart indisponível para o plano ${input.plan}`);
    }
    // `sck` é o parâmetro de tracking do Hotmart — é ecoado de volta no webhook.
    const url = this.appendParam(base, 'sck', input.userId);
    return { preapprovalId: `hotmart-${input.userId}`, initPoint: url };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const expected = this.cfg.get<string>('HOTMART_HOTTOK');
    if (!expected) {
      this.logger.warn('HOTMART_HOTTOK not configured — accepting webhook without verification (DEV ONLY)');
      return this.cfg.get('NODE_ENV') !== 'production';
    }

    // O Hotmart envia o hottok no header `x-hotmart-hottok` ou no corpo JSON (campo `hottok`).
    let token: string | undefined;
    const headerTok = headers['x-hotmart-hottok'];
    if (typeof headerTok === 'string') {
      token = headerTok;
    } else {
      try {
        const body = JSON.parse(rawBody.toString('utf8')) as { hottok?: string };
        token = body?.hottok;
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

  /** Tenta recuperar o `sck` (userId) que enviamos, em vários caminhos defensivos. */
  private extractTrackingUserId(data: any): string | undefined {
    return (
      data?.purchase?.sckPaymentLink
      ?? data?.purchase?.tracking?.source_sck
      ?? data?.purchase?.tracking?.source
      ?? data?.tracking?.source_sck
      ?? data?.tracking?.source
      ?? undefined
    );
  }

  private matchPlanFromOfferCode(code?: string | null): SubPlan {
    if (code && code === this.cfg.get('HOTMART_OFFER_YEARLY_CODE')) return 'YEARLY';
    if (code && code === this.cfg.get('HOTMART_OFFER_MONTHLY_CODE')) return 'MONTHLY';
    return 'MONTHLY';
  }

  async parseEvent(payload: unknown): Promise<ProviderEvent> {
    const p = payload as {
      event?: string;
      data?: {
        purchase?: {
          transaction?: string;
          status?: string;
          recurrence_number?: number;
          offer?: { code?: string };
          [k: string]: any;
        };
        subscription?: { subscriber?: { code?: string }; status?: string };
        buyer?: { email?: string };
        [k: string]: any;
      };
    };
    const data = p.data ?? {};
    const transaction = data.purchase?.transaction;
    const externalId =
      transaction
      ?? crypto.createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex').slice(0, 32);

    // Mapeia o tipo do evento -> status normalizado
    let status: string;
    switch (p.event) {
      case 'PURCHASE_APPROVED':
      case 'PURCHASE_COMPLETE':
        status = 'active';
        break;
      case 'PURCHASE_REFUNDED':
      case 'PURCHASE_CHARGEBACK':
      case 'PURCHASE_CANCELED':
      case 'SUBSCRIPTION_CANCELLATION':
        status = 'canceled';
        break;
      default:
        return { type: 'ignored', externalId };
    }

    // Recupera o userId: primeiro pelo tracking ecoado, senão por lookup via email.
    let userId = this.extractTrackingUserId(data);
    if (!userId) {
      // Normaliza igual ao cadastro (trim + minúsculas): senão "Ana@X.com" do
      // Hotmart não casa com o "ana@x.com" gravado e o pagante não vira Premium.
      const email = normalizeEmail(data.buyer?.email);
      if (email) {
        const user = await this.prisma.user.findFirst({ where: { email }, select: { id: true } });
        userId = user?.id;
      }
    }
    if (!userId) {
      this.logger.warn(`Hotmart webhook ${externalId} sem userId recuperável — ignorando`);
      return { type: 'ignored', externalId };
    }

    const plan = this.matchPlanFromOfferCode(data.purchase?.offer?.code);

    return {
      type: 'subscription.updated',
      externalId,
      subscription: {
        mpPreapprovalId: transaction ?? externalId,
        userId,
        status,
        plan,
        nextPaymentAt: null,
      },
    };
  }

  /**
   * O Hotmart não oferece cancelamento simples por API sem OAuth (fluxo de
   * autorização do app). O cancelamento de assinatura deve ser feito no painel
   * do Hotmart. Aqui apenas logamos um aviso (no-op).
   */
  async cancel(id: string): Promise<void> {
    this.logger.warn(
      `Cancelamento Hotmart de "${id}" deve ser feito no painel do Hotmart (sem API sem OAuth). No-op.`,
    );
  }
}
