/**
 * Janelas de período — data-math PURA, compartilhada por metas/missões/desafios
 * (antes era duplicada 4× e a cópia do goals estava bugada: derivava o fim ANTES
 * de deslocar o início, então uma meta mensal criada no dia 15 fechava no dia 15
 * do mês seguinte em vez do dia 1).
 */

export type Period = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Segunda-feira 00:00 da semana de `now` (semana começa na segunda). */
export function weekStart(now: Date): Date {
  const s = new Date(now);
  s.setHours(0, 0, 0, 0);
  const day = s.getDay(); // 0=Dom .. 1=Seg
  const diff = day === 0 ? -6 : 1 - day;
  s.setDate(s.getDate() + diff);
  return s;
}

/** Janela [start, end) do período que contém `now`. `end` é sempre derivado do start já deslocado. */
export function periodWindow(period: Period, now: Date): { start: Date; end: Date } {
  if (period === 'WEEKLY') {
    const start = weekStart(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'MONTHLY') {
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  if (period === 'YEARLY') {
    start.setMonth(0, 1);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1, 0, 1);
    return { start, end };
  }

  // DAILY (default)
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
