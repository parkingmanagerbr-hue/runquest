/**
 * Determinação AUTORITATIVA de acesso premium — fonte única. Os gates de IA
 * (ai-generate/coach-chat/analyze) checavam só o booleano `isPremium` do banco,
 * SEM conferir `premiumUntil`. Se um webhook de cancelamento MP/Stripe fosse
 * perdido, o `isPremium` ficava `true` além da validade e o usuário expirado
 * mantinha a IA (vazamento de receita). Aqui a regra bate com o getter da
 * entidade e o PremiumGuard.
 */
export interface PremiumFields {
  isPremium?: boolean | null;
  premiumUntil?: Date | null;
  isOwner?: boolean | null;
}

/** O usuário tem acesso premium AGORA? Owner sempre; senão premium não-expirado. */
export function isPremiumActive(u: PremiumFields | null | undefined, now: Date = new Date()): boolean {
  if (!u) return false;
  if (u.isOwner) return true; // dono do app = acesso total
  if (!u.isPremium) return false;
  // premiumUntil null = nunca expira (Hotmart/Cakto); futuro = ativo; passado = expirado.
  return !u.premiumUntil || u.premiumUntil > now;
}
