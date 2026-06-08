/**
 * Tabela de preços internacional do RunQuest Premium.
 *
 * Preço definido POR MOEDA (não só conversão automática) para permitir
 * pricing por poder de compra (PPP) em cada mercado. O país do usuário
 * mapeia para uma moeda, e cada moeda é cobrada pelo gateway adequado:
 *   - BRL  -> Mercado Pago (Brasil)
 *   - demais -> Stripe (internacional, multi-moeda)
 */

export type SubPlan = 'MONTHLY' | 'YEARLY';
export type Provider = 'mercadopago' | 'stripe';

export interface CurrencyPricing {
  currency: string; // ISO 4217 (ex.: 'USD')
  symbol: string;
  monthly: number; // unidade maior (ex.: dólares, não centavos)
  yearly: number;
  provider: Provider;
}

export const PRICING: Record<string, CurrencyPricing> = {
  BRL: { currency: 'BRL', symbol: 'R$', monthly: 19.9, yearly: 99.9, provider: 'mercadopago' },
  USD: { currency: 'USD', symbol: '$', monthly: 4.99, yearly: 39.99, provider: 'stripe' },
  EUR: { currency: 'EUR', symbol: '€', monthly: 4.99, yearly: 39.99, provider: 'stripe' },
  GBP: { currency: 'GBP', symbol: '£', monthly: 4.49, yearly: 35.99, provider: 'stripe' },
  CAD: { currency: 'CAD', symbol: 'CA$', monthly: 6.99, yearly: 54.99, provider: 'stripe' },
  AUD: { currency: 'AUD', symbol: 'A$', monthly: 7.99, yearly: 59.99, provider: 'stripe' },
  MXN: { currency: 'MXN', symbol: 'MX$', monthly: 89, yearly: 699, provider: 'stripe' },
};

export const DEFAULT_CURRENCY = 'USD';

/** País (ISO 3166-1 alpha-2) -> moeda. Controle total de pricing por mercado. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  BR: 'BRL',
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  UK: 'GBP',
  AU: 'AUD',
  MX: 'MXN',
  PT: 'EUR', ES: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR',
  IE: 'EUR', NL: 'EUR', AT: 'EUR', BE: 'EUR', PL: 'EUR',
};

export function currencyForCountry(country?: string | null): string {
  if (!country) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? DEFAULT_CURRENCY;
}

export function pricingForCurrency(currency?: string | null): CurrencyPricing {
  if (!currency) return PRICING[DEFAULT_CURRENCY];
  return PRICING[currency.toUpperCase()] ?? PRICING[DEFAULT_CURRENCY];
}

export function amountFor(currency: string, plan: SubPlan): number {
  const p = pricingForCurrency(currency);
  return plan === 'MONTHLY' ? p.monthly : p.yearly;
}

export function providerForCurrency(currency?: string | null): Provider {
  return pricingForCurrency(currency).provider;
}
