import { pointsToCells, capturesOnThisVisit, VISITS_TO_CAPTURE, H3_RES } from './territory-cells';
import { latLngToCell } from 'h3-js';

describe('pointsToCells', () => {
  it('converte [lng,lat] em células H3 (ordem correta p/ a h3-js)', () => {
    // São Paulo ~(-23.55, -46.63). GeoJSON manda [lng, lat].
    const cells = pointsToCells([[-46.63, -23.55]]);
    expect(cells.size).toBe(1);
    expect(cells.has(latLngToCell(-23.55, -46.63, H3_RES))).toBe(true);
  });

  it('deduplica pontos que caem na mesma célula (~150 m)', () => {
    // Dois pontos a poucos metros → mesma célula res 9.
    const cells = pointsToCells([[-46.6300, -23.5500], [-46.63005, -23.55005]]);
    expect(cells.size).toBe(1);
  });

  it('conta células distintas de pontos afastados', () => {
    const cells = pointsToCells([[-46.63, -23.55], [-46.65, -23.57]]);
    expect(cells.size).toBe(2);
  });

  it('descarta pontos malformados sem quebrar (NaN, curtos, não-array)', () => {
    const cells = pointsToCells([
      [-46.63, -23.55], // ok
      [NaN, -23.55],
      [-46.63], // curto
      null as unknown as number[],
      [999, 999], // fora do intervalo lat/lng → barrado (h3-js NÃO valida sozinha)
    ]);
    expect(cells.size).toBe(1);
  });

  it('glitch de GPS com coordenada absurda NÃO vira território fantasma', () => {
    // A h3-js aceitaria (999, 999) e devolveria uma célula; a guarda de intervalo impede.
    expect(pointsToCells([[999, 999], [200, -200], [-46.63, -23.55]]).size).toBe(1);
  });

  it('entrada vazia/invalida → conjunto vazio', () => {
    expect(pointsToCells([]).size).toBe(0);
    expect(pointsToCells(null as unknown as number[][]).size).toBe(0);
  });
});

describe('capturesOnThisVisit', () => {
  it(`captura exatamente quando a ${VISITS_TO_CAPTURE}ª visita chega numa célula ainda não capturada`, () => {
    expect(capturesOnThisVisit(0, false)).toBe(false); // vira 1
    expect(capturesOnThisVisit(1, false)).toBe(false); // vira 2
    expect(capturesOnThisVisit(2, false)).toBe(true); // vira 3 → captura
    expect(capturesOnThisVisit(5, false)).toBe(true); // acima do limiar tb
  });

  it('célula já capturada NUNCA captura de novo (idempotente)', () => {
    expect(capturesOnThisVisit(2, true)).toBe(false);
    expect(capturesOnThisVisit(10, true)).toBe(false);
  });
});
