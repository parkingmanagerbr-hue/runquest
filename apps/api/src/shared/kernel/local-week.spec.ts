import { localMondayStart, localDayIndexSinceMonday, parseTzOffsetMin } from './local-week';

// Helper: instante UTC a partir de componentes.
const utc = (y: number, m: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min));
const BRT = 180; // UTC-3, em minutos (getTimezoneOffset)

describe('localMondayStart', () => {
  it('UTC: segunda-feira da semana às 00:00', () => {
    // 2026-07-15 é uma quarta. Segunda = 13/jul 00:00 UTC.
    const m = localMondayStart(utc(2026, 7, 15, 12), 0);
    expect(m.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('BRT: corrida domingo 22h LOCAL fica na semana que começou na segunda ANTERIOR', () => {
    // Domingo 2026-07-19 22:00 BRT = 2026-07-20 01:00 UTC.
    // No fuso do usuário ainda é domingo/19 → semana começou segunda 13/jul.
    // Segunda 00:00 BRT = 03:00 UTC.
    const sundayNightUtc = utc(2026, 7, 20, 1); // 22h BRT do domingo
    const m = localMondayStart(sundayNightUtc, BRT);
    expect(m.toISOString()).toBe('2026-07-13T03:00:00.000Z'); // seg 00:00 BRT
  });

  it('BRT vs UTC divergem no domingo à noite (o bug que isto corrige)', () => {
    const sundayNightUtc = utc(2026, 7, 20, 1); // 22h BRT dom / 01h UTC seg
    // Servidor UTC já rolou p/ segunda 20/jul → semana "começa" 20/jul.
    const serverUtc = localMondayStart(sundayNightUtc, 0);
    const userBrt = localMondayStart(sundayNightUtc, BRT);
    expect(serverUtc.toISOString()).toBe('2026-07-20T00:00:00.000Z'); // errado p/ o usuário
    expect(userBrt.toISOString()).toBe('2026-07-13T03:00:00.000Z'); // certo
  });

  it('segunda-feira de manhã → a própria segunda', () => {
    const m = localMondayStart(utc(2026, 7, 13, 9), 0); // seg 09:00 UTC
    expect(m.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('fuso a leste (UTC+9, offset -540)', () => {
    // Tóquio: 2026-07-13 08:00 JST = 2026-07-12 23:00 UTC (domingo). Segunda local = 13/jul 00:00 JST = 12/jul 15:00 UTC.
    const m = localMondayStart(utc(2026, 7, 12, 23), -540);
    expect(m.toISOString()).toBe('2026-07-12T15:00:00.000Z');
  });
});

describe('localDayIndexSinceMonday', () => {
  it('índice 0=seg … 6=dom', () => {
    const monday = utc(2026, 7, 13, 3); // seg 00:00 BRT
    expect(localDayIndexSinceMonday(utc(2026, 7, 13, 12), monday)).toBe(0); // seg
    expect(localDayIndexSinceMonday(utc(2026, 7, 15, 12), monday)).toBe(2); // qua
    expect(localDayIndexSinceMonday(utc(2026, 7, 20, 1), monday)).toBe(6); // dom 22h BRT
  });
});

describe('parseTzOffsetMin', () => {
  it('lê offsets reais', () => {
    expect(parseTzOffsetMin('180')).toBe(180);
    expect(parseTzOffsetMin('-540')).toBe(-540);
    expect(parseTzOffsetMin('0')).toBe(0);
  });
  it('ausente/absurdo → 0 (UTC)', () => {
    expect(parseTzOffsetMin(undefined)).toBe(0);
    expect(parseTzOffsetMin('abc')).toBe(0);
    expect(parseTzOffsetMin('99999')).toBe(0); // fora de -12h..+14h
  });
});
