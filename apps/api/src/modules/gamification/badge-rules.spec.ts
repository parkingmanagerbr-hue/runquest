import { badgeQualifies } from './badge-rules';

describe('badgeQualifies — exigências de limiar (>=)', () => {
  const cases: [string, keyof typeof ctxFull][] = [
    ['total_runs', 'totalRuns'],
    ['total_distance', 'totalDistanceM'],
    ['streak', 'streak'],
    ['level', 'level'],
    ['territories', 'territories'],
    ['single_run_distance', 'singleRunDistanceM'],
  ];
  const ctxFull = {
    totalRuns: 0, totalDistanceM: 0, streak: 0, level: 0, territories: 0, singleRunDistanceM: 0,
  };

  for (const [kind, key] of cases) {
    it(`${kind}: qualifica no limiar e acima; falha abaixo`, () => {
      expect(badgeQualifies(kind, 10, { [key]: 10 })).toBe(true); // exatamente no limiar
      expect(badgeQualifies(kind, 10, { [key]: 11 })).toBe(true); // acima
      expect(badgeQualifies(kind, 10, { [key]: 9 })).toBe(false); // abaixo
    });
    it(`${kind}: contexto ausente conta como 0`, () => {
      expect(badgeQualifies(kind, 1, {})).toBe(false);
      expect(badgeQualifies(kind, 0, {})).toBe(true); // limiar 0 sempre satisfeito
    });
  }
});

describe('badgeQualifies — pace_under (exige pace REAL)', () => {
  it('pace ≤ limiar (mais rápido) qualifica', () => {
    expect(badgeQualifies('pace_under', 300, { singleRunPaceSecPerKm: 280 })).toBe(true);
    expect(badgeQualifies('pace_under', 300, { singleRunPaceSecPerKm: 300 })).toBe(true);
  });
  it('pace > limiar (mais lento) não qualifica', () => {
    expect(badgeQualifies('pace_under', 300, { singleRunPaceSecPerKm: 320 })).toBe(false);
  });
  it('pace 0 (corrida sem GPS) NÃO qualifica — mesmo sendo <= limiar', () => {
    expect(badgeQualifies('pace_under', 300, { singleRunPaceSecPerKm: 0 })).toBe(false);
  });
  it('pace ausente/undefined não qualifica', () => {
    expect(badgeQualifies('pace_under', 300, {})).toBe(false);
  });
});

describe('badgeQualifies — robustez', () => {
  it('tipo de exigência desconhecido nunca desbloqueia', () => {
    expect(badgeQualifies('coffees_drunk', 1, { totalRuns: 999 })).toBe(false);
    expect(badgeQualifies('', 0, {})).toBe(false);
  });
});
