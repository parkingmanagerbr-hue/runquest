/**
 * Parse do pace-alvo digitado ("m:ss") em segundos por km. PURO e testável —
 * antes vivia inline no componente de corrida e aceitava segundos inválidos
 * (ex.: "5:75" virava 6:15). Aqui rejeita segundos ≥ 60 e tolera espaços.
 * Retorna 0 para qualquer entrada inválida (o app trata 0 como "sem alvo").
 */
export function parseTargetPace(input: string): number {
  const m = input.trim().match(/^(\d+):(\d{2})$/);
  if (!m) return 0;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  if (sec >= 60) return 0; // "5:75" não é um pace válido
  return min * 60 + sec;
}
