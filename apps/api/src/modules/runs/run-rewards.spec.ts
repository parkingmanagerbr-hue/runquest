import { computeStreak, computeRunRewards, levelForXp } from './run-rewards';

const at = (iso: string) => new Date(iso);

describe('computeStreak', () => {
  it('sem corrida anterior → 1', () => {
    expect(computeStreak(null, at('2026-07-10T08:00:00'), 5)).toBe(1);
  });
  it('mesma data (2ª corrida do dia) → mantém o streak', () => {
    expect(computeStreak(at('2026-07-10T06:00:00'), at('2026-07-10T20:00:00'), 4)).toBe(4);
  });
  it('dia seguinte → +1', () => {
    expect(computeStreak(at('2026-07-09T22:00:00'), at('2026-07-10T06:00:00'), 4)).toBe(5);
  });
  it('gap de 2+ dias → reinicia em 1', () => {
    expect(computeStreak(at('2026-07-07T10:00:00'), at('2026-07-10T10:00:00'), 9)).toBe(1);
  });
  it('mesma data com streak 0/null → 1 (corrige o NaN latente)', () => {
    expect(computeStreak(at('2026-07-10T06:00:00'), at('2026-07-10T20:00:00'), 0)).toBe(1);
  });
  it('compara por DIA, não por 24h (23h→1h da manhã seguinte = +1)', () => {
    expect(computeStreak(at('2026-07-09T23:30:00'), at('2026-07-10T01:00:00'), 3)).toBe(4);
  });
});

describe('computeRunRewards', () => {
  it('golden: 5 km em 25 min, streak 1', () => {
    // baseXp = 50 + 25 + 0 (não > 5km) = 75; mult = 1.05; xp = round(78.75) = 79
    const r = computeRunRewards(5000, 1500, 1);
    expect(r.xpGain).toBe(79);
    expect(r.coinGain).toBe(50);
    expect(r.streakMult).toBeCloseTo(1.05, 5);
  });
  it('golden: 10 km em 50 min, streak 3 (bônus > 5 km)', () => {
    // baseXp = 100 + 50 + 20 = 170; mult = 1.15; 170×1.15 = 195.4999… (float) → round 195
    const r = computeRunRewards(10000, 3000, 3);
    expect(r.xpGain).toBe(195);
    expect(r.coinGain).toBe(100);
    expect(r.streakMult).toBeCloseTo(1.15, 5);
  });
  it('multiplicador satura em 7 dias (1.35×) e não passa disso', () => {
    expect(computeRunRewards(5000, 1500, 7).streakMult).toBeCloseTo(1.35, 5);
    expect(computeRunRewards(5000, 1500, 30).streakMult).toBeCloseTo(1.35, 5);
  });
  it('streak maior ⇒ XP maior (monótono) para a mesma corrida', () => {
    const a = computeRunRewards(8000, 2400, 1).xpGain;
    const b = computeRunRewards(8000, 2400, 5).xpGain;
    expect(b).toBeGreaterThan(a);
  });
  it('nunca gera NaN, mesmo com streak 0', () => {
    const r = computeRunRewards(3000, 900, 0);
    expect(Number.isFinite(r.xpGain)).toBe(true);
    expect(Number.isFinite(r.coinGain)).toBe(true);
  });
});

describe('levelForXp', () => {
  it('nível 1 até atingir 100 XP (100·1^1.5)', () => {
    expect(levelForXp(0, 1)).toBe(1);
    expect(levelForXp(99, 1)).toBe(1);
    expect(levelForXp(100, 1)).toBe(2);
  });
  it('limiares: nível 2 exige ~283 XP (100·2^1.5)', () => {
    // 100*2^1.5 = 282.8 → round 283
    expect(levelForXp(282, 1)).toBe(2);
    expect(levelForXp(283, 1)).toBe(3);
  });
  it('pode subir vários níveis de uma vez com XP alto', () => {
    expect(levelForXp(100000, 1)).toBeGreaterThan(20);
  });
  it('monótono não-decrescente no XP', () => {
    let prev = 1;
    for (let xp = 0; xp <= 5000; xp += 137) {
      const lv = levelForXp(xp, 1);
      expect(lv).toBeGreaterThanOrEqual(prev);
      prev = lv;
    }
  });
});
