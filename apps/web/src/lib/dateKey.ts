/**
 * Chave de data no fuso LOCAL (YYYY-MM-DD). Corrige o bug do heatmap de stats,
 * que usava `toISOString().slice(0,10)` (UTC): uma corrida às 22h em BRT (UTC-3)
 * caía no dia seguinte no heatmap, enquanto a distribuição por dia-da-semana usa
 * hora local — os dois gráficos discordavam, e "hoje" pulava para amanhã após 21h.
 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
