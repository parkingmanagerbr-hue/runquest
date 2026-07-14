/**
 * Regra PURA de desbloqueio de badge — extraída do BadgeUnlockService para ser
 * testável de forma determinística (stakes reais: o usuário ganha/não ganha a
 * conquista). Sem Prisma/rede.
 */

export interface BadgeContext {
  totalRuns?: number;
  totalDistanceM?: number;
  streak?: number;
  level?: number;
  territories?: number;
  singleRunDistanceM?: number;
  singleRunPaceSecPerKm?: number;
}

/** O usuário qualifica para um badge dado o tipo/valor da exigência e o contexto? */
export function badgeQualifies(requirementKind: string, requirementValue: number, ctx: BadgeContext): boolean {
  switch (requirementKind) {
    case 'total_runs': return (ctx.totalRuns ?? 0) >= requirementValue;
    case 'total_distance': return (ctx.totalDistanceM ?? 0) >= requirementValue;
    case 'streak': return (ctx.streak ?? 0) >= requirementValue;
    case 'level': return (ctx.level ?? 0) >= requirementValue;
    case 'territories': return (ctx.territories ?? 0) >= requirementValue;
    case 'single_run_distance': return (ctx.singleRunDistanceM ?? 0) >= requirementValue;
    // "pace abaixo de X": exige pace REAL (> 0) — corrida sem GPS (pace 0) NÃO
    // pode desbloquear um badge de ritmo rápido.
    case 'pace_under':
      return ctx.singleRunPaceSecPerKm != null
        && ctx.singleRunPaceSecPerKm > 0
        && ctx.singleRunPaceSecPerKm <= requirementValue;
    default:
      return false; // tipo desconhecido nunca desbloqueia
  }
}
