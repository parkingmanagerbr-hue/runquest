import { describe, it, expect } from 'vitest';
import { localDateKey } from '../dateKey';

describe('localDateKey — chave de data no fuso local', () => {
  it('formata YYYY-MM-DD com zero à esquerda', () => {
    expect(localDateKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05'); // 5 jan
    expect(localDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('usa componentes LOCAIS — corrida 22h não vaza para o dia seguinte', () => {
    // 15/jul 22:00 horário local. toISOString() (UTC) em BRT daria 16/jul; aqui fica 15.
    const lateNight = new Date(2026, 6, 15, 22, 0);
    expect(localDateKey(lateNight)).toBe('2026-07-15');
  });

  it('meia-noite local pertence ao próprio dia', () => {
    expect(localDateKey(new Date(2026, 6, 15, 0, 0))).toBe('2026-07-15');
  });
});
