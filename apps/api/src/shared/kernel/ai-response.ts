/**
 * Helpers PUROS de provedores de IA — coleta de chaves e extração de texto.
 * Estavam inline e duplicados em plans.module.ts e runs.module.ts (a cadeia
 * Gemini→SambaNova inteira, ~80 linhas, replicada). Aqui viram unidades testáveis.
 */

/** Coleta chaves numeradas (`BASE`, `BASE_2`, … `BASE_n`), descartando vazias. */
export function collectApiKeys(
  get: (name: string) => string | undefined,
  base: string,
  count: number,
): string[] {
  const keys: string[] = [];
  for (let n = 1; n <= count; n++) {
    const value = get(n === 1 ? base : `${base}_${n}`) ?? '';
    if (value.length > 0) keys.push(value);
  }
  return keys;
}

/** Texto de uma resposta do Gemini (`generateContent`); '' se a forma não bater. */
export function geminiText(data: unknown): string {
  const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/** Texto de uma resposta OpenAI-compatível (`chat/completions`); '' se não bater. */
export function openAiText(data: unknown): string {
  const d = data as { choices?: { message?: { content?: string } }[] };
  return d?.choices?.[0]?.message?.content ?? '';
}
