import { describe, it, expect } from 'vitest';
import { riegelPredict, pacesFromReference } from '../trainingPaces';
import { tCritical95 } from '../fitnessTrend';

/**
 * GOLDEN TESTS — validação contra VERDADE EXTERNA, não só consistência interna.
 * Boa prática de ML/ciência: comparar o modelo a valores de referência
 * publicados (ground truth). Se alguém trocar um expoente, uma constante da
 * tabela ou uma unidade, estes testes quebram.
 */

describe('Riegel — equivalência de provas vs calculadoras publicadas', () => {
  // Corredor de 20:00 no 5K (1200 s). Valores da fórmula de Riegel (expoente 1.06,
  // Riegel 1981); conferem com calculadoras públicas (~41:41 / ~1:32 / ~3:12).
  it('20:00 no 5K → 10K ≈ 41:42', () => {
    expect(Math.abs(riegelPredict(5000, 1200, 10000) - 2502)).toBeLessThanOrEqual(2);
  });
  it('20:00 no 5K → meia (21.0975 km) ≈ 1:32:00', () => {
    expect(Math.abs(riegelPredict(5000, 1200, 21097.5) - 5520)).toBeLessThanOrEqual(3);
  });
  it('20:00 no 5K → maratona ≈ 3:11:49', () => {
    expect(Math.abs(riegelPredict(5000, 1200, 42195) - 11509)).toBeLessThanOrEqual(3);
  });
  it('expoente É 1.06 (não linear): 2×distância NÃO é 2×tempo', () => {
    // linear (expoente 1.0) daria 2400s; Riegel dá ~2502s. Guard contra regressão do expoente.
    expect(riegelPredict(5000, 1200, 10000)).toBeGreaterThan(2450);
  });
});

describe('t de Student — tabela crítica 95% bicaudal vs valores publicados', () => {
  // Ground truth (tabela t, α=0,05 bicaudal).
  const published: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  };
  for (const [df, ref] of Object.entries(published)) {
    it(`df=${df} → t≈${ref}`, () => {
      expect(Math.abs(tCritical95(Number(df)) - ref)).toBeLessThan(0.02);
    });
  }
  it('df grande → converge ao z (~1.96–1.98)', () => {
    expect(tCritical95(1000)).toBeGreaterThan(1.9);
    expect(tCritical95(1000)).toBeLessThan(2.0);
  });
  it('df pequeno exige t MUITO maior que 2 (não superdeclarar)', () => {
    expect(tCritical95(2)).toBeGreaterThan(4); // 4.303
  });
});

describe('Zonas de treino — vs tabela de Jack Daniels (VDOT ~50, 5K 20:00)', () => {
  // Paces de treino do Daniels p/ um corredor de 20:00 no 5K (s/km, aprox.):
  //   fácil ~5:03–5:35 · maratona ~4:38 · limiar ~4:19 · intervalado ~4:00 · repetição ~3:43
  const { paces } = pacesFromReference(5000, 1200);
  const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
  it('fácil no ballpark de Daniels (5:00–5:35/km)', () => {
    expect(inRange(paces.easy, 300, 335)).toBe(true);
  });
  it('maratona ~4:35–4:40/km', () => {
    expect(inRange(paces.marathon, 265, 290)).toBe(true);
  });
  it('limiar ~4:15–4:25/km', () => {
    expect(inRange(paces.threshold, 248, 270)).toBe(true);
  });
  it('intervalado ~3:55–4:05/km', () => {
    expect(inRange(paces.interval, 225, 250)).toBe(true);
  });
  it('repetição ~3:40–3:50/km', () => {
    expect(inRange(paces.repetition, 210, 235)).toBe(true);
  });
  it('ordem estrita: rep < intervalo < limiar < maratona < fácil < recuperação', () => {
    expect(paces.repetition).toBeLessThan(paces.interval);
    expect(paces.interval).toBeLessThan(paces.threshold);
    expect(paces.threshold).toBeLessThan(paces.marathon);
    expect(paces.marathon).toBeLessThan(paces.easy);
    expect(paces.easy).toBeLessThan(paces.recovery);
  });
});
