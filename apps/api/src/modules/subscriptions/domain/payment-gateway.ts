/** Port para gateway de pagamentos. Implementações: Mercado Pago (BRL) e Stripe (internacional). */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export const STRIPE_GATEWAY = Symbol('STRIPE_GATEWAY');
export const HOTMART_GATEWAY = Symbol('HOTMART_GATEWAY');
export const CAKTO_GATEWAY = Symbol('CAKTO_GATEWAY');

export type SubPlan = 'MONTHLY' | 'YEARLY';
export type ProviderName = 'mercadopago' | 'stripe' | 'hotmart' | 'cakto';

export interface CreateCheckoutInput {
  userId: string;
  email: string;
  plan: SubPlan;
  currency: string; // ISO 4217 — define o gateway e o valor cobrado
  locale?: string;  // idioma da UI (ex.: 'pt-BR') — usado p/ traduzir a tela do gateway
}

export interface CheckoutResult {
  preapprovalId: string;
  initPoint: string;
}

export interface ProviderEvent {
  type: 'subscription.updated' | 'payment.received' | 'ignored';
  externalId: string;
  subscription?: {
    mpPreapprovalId: string;
    userId: string;
    status: string;
    plan?: SubPlan;
    nextPaymentAt?: Date | null;
  };
}

export interface PaymentGateway {
  /** Identificador do provider (usado p/ idempotência de webhook). */
  readonly name: ProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseEvent(payload: unknown): Promise<ProviderEvent>;
  cancel(mpPreapprovalId: string): Promise<void>;
  /**
   * Opcional: provedores como o Stripe verificam a assinatura E parseiam o
   * evento na mesma operação (a partir do raw body). Se presente, o use case
   * usa este método no lugar de verifyWebhook + parseEvent.
   * Retorna null se a assinatura for inválida.
   */
  parseSignedEvent?(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<ProviderEvent | null>;
}
