import { describe, it, expect } from 'vitest';
import { pricingForCurrency, currencyForCountry, PRICING, DEFAULT_CURRENCY } from '../pricing';

describe('pricingForCurrency', () => {
  it('moeda conhecida retorna sua tabela', () => {
    expect(pricingForCurrency('BRL').provider).toBe('mercadopago');
    expect(pricingForCurrency('USD').provider).toBe('stripe');
    expect(pricingForCurrency('BRL').monthly).toBe(PRICING.BRL.monthly);
  });
  it('case-insensitive', () => {
    expect(pricingForCurrency('brl').currency).toBe('BRL');
  });
  it('moeda desconhecida / null → default', () => {
    expect(pricingForCurrency('XYZ').currency).toBe(DEFAULT_CURRENCY);
    expect(pricingForCurrency(null).currency).toBe(DEFAULT_CURRENCY);
    expect(pricingForCurrency(undefined).currency).toBe(DEFAULT_CURRENCY);
  });
});

describe('currencyForCountry', () => {
  it('mapeia países conhecidos', () => {
    expect(currencyForCountry('BR')).toBe('BRL');
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('PT')).toBe('EUR');
    expect(currencyForCountry('gb')).toBe('GBP');
  });
  it('país desconhecido / null → default', () => {
    expect(currencyForCountry('ZZ')).toBe(DEFAULT_CURRENCY);
    expect(currencyForCountry(null)).toBe(DEFAULT_CURRENCY);
  });
  it('só provedores válidos e valores positivos em toda a tabela', () => {
    for (const p of Object.values(PRICING)) {
      expect(['mercadopago', 'stripe']).toContain(p.provider);
      expect(p.monthly).toBeGreaterThan(0);
      expect(p.yearly).toBeGreaterThan(p.monthly); // anual > mensal
    }
  });
});
