import { describe, it, expect } from 'vitest';
import { estimateCalories, DEFAULT_WEIGHT_KG } from '../calories';

describe('estimateCalories', () => {
  it('golden: 5 km a 70 kg → 363 kcal', () => {
    // 5 * 70 * 1.036 = 362.6 → 363
    expect(estimateCalories(5000, 70)).toBe(363);
  });

  it('escala com o peso real do usuário', () => {
    expect(estimateCalories(5000, 80)).toBe(414); // 5*80*1.036=414.4
  });

  it('sem peso usa o padrão (70 kg)', () => {
    expect(estimateCalories(5000)).toBe(estimateCalories(5000, DEFAULT_WEIGHT_KG));
    expect(DEFAULT_WEIGHT_KG).toBe(70);
  });

  it('peso inválido (0 ou negativo) cai no padrão — sem zerar calorias', () => {
    expect(estimateCalories(5000, 0)).toBe(estimateCalories(5000, 70));
    expect(estimateCalories(5000, -10)).toBe(estimateCalories(5000, 70));
  });

  it('distância zero → 0', () => {
    expect(estimateCalories(0, 70)).toBe(0);
  });
});
