/**
 * Feedback tátil para ações primárias (iniciar corrida, resgatar recompensa).
 * A Vibration API não existe no iOS Safari nem em desktop, e em alguns browsers
 * lança se chamada sem gesto do usuário — por isso tudo é guardado e a função
 * nunca propaga erro. Retorna se a vibração foi de fato disparada.
 */
type Vibrator = Navigator & { vibrate?: (pattern: number | number[]) => boolean };

/** Toque curto (~10ms): confirmação de um tap. */
export const TAP: number = 10;
/** Padrão de sucesso: dois pulsos curtos. */
export const SUCCESS: number[] = [15, 40, 15];

export function haptic(pattern: number | number[] = TAP): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Vibrator;
  if (typeof nav.vibrate !== 'function') return false;
  try {
    return nav.vibrate(pattern) === true;
  } catch {
    return false;
  }
}
