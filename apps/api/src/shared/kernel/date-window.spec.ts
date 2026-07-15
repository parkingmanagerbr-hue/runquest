import { periodWindow, weekStart } from './date-window';

// Datas construídas em horário LOCAL para não depender de fuso.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 30, 0, 0);
const ymd = (dt: Date) => [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];

describe('periodWindow', () => {
  it('DAILY: hoje 00:00 → amanhã 00:00', () => {
    const { start, end } = periodWindow('DAILY', local(2026, 7, 15));
    expect(ymd(start)).toEqual([2026, 7, 15]);
    expect(ymd(end)).toEqual([2026, 7, 16]);
    expect(start.getHours()).toBe(0);
  });

  it('WEEKLY: segunda-feira da semana → +7 dias', () => {
    // 2026-07-15 é uma quarta → segunda = 13, fim = 20
    const { start, end } = periodWindow('WEEKLY', local(2026, 7, 15));
    expect(ymd(start)).toEqual([2026, 7, 13]);
    expect(ymd(end)).toEqual([2026, 7, 20]);
  });

  it('WEEKLY: domingo volta 6 dias até a segunda', () => {
    // 2026-07-19 é domingo → segunda = 13
    expect(ymd(periodWindow('WEEKLY', local(2026, 7, 19)).start)).toEqual([2026, 7, 13]);
  });

  it('WEEKLY cruzando o mês: fim no mês certo (bug do goals)', () => {
    // 2026-08-02 é domingo → segunda = 27/jul, fim = 03/ago (não fica preso em julho)
    const { start, end } = periodWindow('WEEKLY', local(2026, 8, 2));
    expect(ymd(start)).toEqual([2026, 7, 27]);
    expect(ymd(end)).toEqual([2026, 8, 3]);
  });

  it('MONTHLY: dia 1 → dia 1 do mês seguinte (REGRESSÃO do BUG-3)', () => {
    // Criada no dia 15 — o fim NÃO pode ser 15/ago; tem que ser 01/ago.
    const { start, end } = periodWindow('MONTHLY', local(2026, 7, 15));
    expect(ymd(start)).toEqual([2026, 7, 1]);
    expect(ymd(end)).toEqual([2026, 8, 1]);
  });

  it('MONTHLY em dezembro → fim em 01/jan do ano seguinte', () => {
    const { end } = periodWindow('MONTHLY', local(2026, 12, 20));
    expect(ymd(end)).toEqual([2027, 1, 1]);
  });

  it('YEARLY: 01/jan → 01/jan do ano seguinte', () => {
    const { start, end } = periodWindow('YEARLY', local(2026, 5, 9));
    expect(ymd(start)).toEqual([2026, 1, 1]);
    expect(ymd(end)).toEqual([2027, 1, 1]);
  });

  it('janela sempre não-vazia (start < end)', () => {
    for (const p of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
      const { start, end } = periodWindow(p, local(2026, 7, 15));
      expect(start.getTime()).toBeLessThan(end.getTime());
    }
  });
});

describe('weekStart', () => {
  it('sempre retorna a segunda-feira 00:00', () => {
    const ws = weekStart(local(2026, 7, 15)); // quarta
    expect(ws.getDay()).toBe(1); // segunda
    expect(ymd(ws)).toEqual([2026, 7, 13]);
    expect(ws.getHours()).toBe(0);
  });
});
