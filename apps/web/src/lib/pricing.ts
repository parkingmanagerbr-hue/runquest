/**
 * Espelho client-side da tabela de preços (apps/api .../domain/pricing.ts).
 * Mantenha sincronizado com o backend — o valor real cobrado é o do backend.
 *
 * Pricing por moeda (não só conversão) para PPP por mercado. O país do usuário
 * mapeia para uma moeda, e cada moeda é cobrada pelo gateway adequado:
 *   - BRL  -> Mercado Pago (Brasil)
 *   - demais -> Stripe (internacional)
 */

export type SubPlan = 'MONTHLY' | 'YEARLY';
export type Provider = 'mercadopago' | 'stripe';

export interface CurrencyPricing {
  currency: string;
  locale: string;
  monthly: number;
  yearly: number;
  provider: Provider;
}

export const PRICING: Record<string, CurrencyPricing> = {
  BRL: { currency: 'BRL', locale: 'pt-BR', monthly: 19.9, yearly: 99.9, provider: 'mercadopago' },
  USD: { currency: 'USD', locale: 'en-US', monthly: 4.99, yearly: 39.99, provider: 'stripe' },
  EUR: { currency: 'EUR', locale: 'de-DE', monthly: 4.99, yearly: 39.99, provider: 'stripe' },
  GBP: { currency: 'GBP', locale: 'en-GB', monthly: 4.49, yearly: 35.99, provider: 'stripe' },
  CAD: { currency: 'CAD', locale: 'en-CA', monthly: 6.99, yearly: 54.99, provider: 'stripe' },
  AUD: { currency: 'AUD', locale: 'en-AU', monthly: 7.99, yearly: 59.99, provider: 'stripe' },
  MXN: { currency: 'MXN', locale: 'es-MX', monthly: 89, yearly: 699, provider: 'stripe' },
};

export const DEFAULT_CURRENCY = 'USD';

/** País (ISO 3166-1 alpha-2) -> moeda. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  BR: 'BRL',
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP', UK: 'GBP',
  AU: 'AUD',
  MX: 'MXN',
  PT: 'EUR', ES: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR',
  IE: 'EUR', NL: 'EUR', AT: 'EUR', BE: 'EUR', PL: 'EUR',
};

export function pricingForCurrency(currency?: string | null): CurrencyPricing {
  if (!currency) return PRICING[DEFAULT_CURRENCY];
  return PRICING[currency.toUpperCase()] ?? PRICING[DEFAULT_CURRENCY];
}

export function currencyForCountry(country?: string | null): string {
  if (!country) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? DEFAULT_CURRENCY;
}

/** Detecta a moeda do usuário pelo locale/região do navegador. */
export function detectCurrency(): string {
  if (typeof navigator === 'undefined') return DEFAULT_CURRENCY;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of langs) {
    if (!tag) continue;
    // Tenta a região explícita (ex.: 'pt-BR' -> 'BR')
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region && COUNTRY_CURRENCY[region]) return COUNTRY_CURRENCY[region];
    } catch { /* tag inválida, segue */ }
  }
  return DEFAULT_CURRENCY;
}

export function formatPrice(amount: number, p: CurrencyPricing): string {
  try {
    return new Intl.NumberFormat(p.locale, {
      style: 'currency',
      currency: p.currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${p.currency} ${amount}`;
  }
}

/** Percentual de economia do anual vs. 12× mensal. */
export function yearlySavingsPct(p: CurrencyPricing): number {
  const full = p.monthly * 12;
  if (full <= 0) return 0;
  return Math.round((1 - p.yearly / full) * 100);
}

/** Preço mensal equivalente do plano anual. */
export function yearlyPerMonth(p: CurrencyPricing): number {
  return p.yearly / 12;
}
