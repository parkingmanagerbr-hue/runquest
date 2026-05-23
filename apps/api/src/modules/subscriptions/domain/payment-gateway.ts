/** Port para gateway de pagamentos. Implementação Mercado Pago em infra/. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type SubPlan = 'MONTHLY' | 'YEARLY';

export interface CreateCheckoutInput {
  userId: string;
  email: string;
  plan: SubPlan;
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
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseEvent(payload: unknown): Promise<ProviderEvent>;
  cancel(mpPreapprovalId: string): Promise<void>;
}
