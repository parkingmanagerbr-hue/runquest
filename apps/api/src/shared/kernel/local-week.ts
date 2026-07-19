/**
 * Início da semana (segunda 00:00) no fuso LOCAL do usuário, como INSTANTE
 * absoluto. O servidor roda em UTC no container, então calcular a segunda com
 * `new Date().getDay()` usava a semana do SERVIDOR — um corredor no Brasil (UTC-3)
 * via a corrida de domingo à noite cair na semana errada. O cliente manda o
 * offset (`new Date().getTimezoneOffset()`, minutos; BRT = 180) e aqui a conta é
 * feita no referencial local e convertida de volta para o instante absoluto.
 */

const DAY_MS = 86_400_000;

/** Nº de dias desde a época no referencial local (piso). */
function localDayNumber(instant: Date, tzOffsetMin: number): number {
  return Math.floor((instant.getTime() - tzOffsetMin * 60_000) / DAY_MS);
}

/** Instante absoluto da segunda-feira 00:00 local da semana que contém `now`. */
export function localMondayStart(now: Date, tzOffsetMin: number): Date {
  const day = localDayNumber(now, tzOffsetMin);
  // Época (1970-01-01) foi quinta → offset 3 p/ colocar segunda em 0.
  const weekdayMon0 = ((day % 7) + 3 + 7) % 7;
  const mondayDay = day - weekdayMon0;
  return new Date(mondayDay * DAY_MS + tzOffsetMin * 60_000);
}

/** Índice do dia (0=seg … 6=dom) em que `instant` cai, relativo a `mondayStart`. */
export function localDayIndexSinceMonday(instant: Date, mondayStart: Date): number {
  return Math.floor((instant.getTime() - mondayStart.getTime()) / DAY_MS);
}

/** Lê e valida o offset de fuso (minutos) vindo do cliente; 0 (UTC) se ausente/absurdo. */
export function parseTzOffsetMin(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n) > 14 * 60) return 0; // fusos reais: -12h..+14h
  return Math.trunc(n);
}
