/**
 * Mecânica de jogo de uma corrida — funções PURAS (sem Prisma/rede), extraídas
 * do RunsService para poderem ser testadas de forma determinística.
 */

/**
 * Streak de dias consecutivos. Compara as datas ao nível do DIA (meia-noite):
 *  - mesma data (2ª corrida do dia) → mantém o streak (nunca < 1);
 *  - dia seguinte → +1;
 *  - qualquer gap maior → reinicia em 1.
 * (Corrige um NaN latente: antes, corrida no mesmo dia com streak nulo virava
 *  undefined → NaN no multiplicador. Agora é ≥ 1.)
 */
export function computeStreak(lastRunAt: Date | null, now: Date, currentStreak: number): number {
  if (!lastRunAt) return 1;
  const last = new Date(lastRunAt); last.setHours(0, 0, 0, 0);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);
  if (diffDays === 0) return Math.max(currentStreak, 1);
  if (diffDays === 1) return currentStreak + 1;
  return 1;
}

export interface RunRewards {
  xpGain: number;
  coinGain: number;
  streakMult: number;
}

/**
 * XP e moedas de uma corrida.
 *  baseXp = 10·km + minutos + (bônus 20 se > 5 km)
 *  multiplicador de streak = 1 + min(streak, 7)·0,05  (cap em 7 dias = 1,35×)
 *  moedas = 10·km
 */
export function computeRunRewards(distanceMeters: number, durationSec: number, streak: number): RunRewards {
  const distKm = distanceMeters / 1000;
  const streakMult = 1 + Math.min(Math.max(0, streak), 7) * 0.05;
  const baseXp = distKm * 10 + durationSec / 60 + (distKm > 5 ? 20 : 0);
  return {
    xpGain: Math.round(baseXp * streakMult),
    coinGain: Math.round(distKm * 10),
    streakMult,
  };
}

/** Nível a partir do XP total: sobe enquanto xp ≥ round(100·nível^1.5). */
export function levelForXp(xp: number, fromLevel = 1): number {
  let level = Math.max(1, Math.floor(fromLevel));
  while (xp >= Math.round(100 * Math.pow(level, 1.5))) level++;
  return level;
}
