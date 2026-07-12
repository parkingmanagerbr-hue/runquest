import { describe, it, expect } from 'vitest';
import { buildTemplates, templateToWorkoutBody } from '../workoutTemplates';
import { pacesFromReference } from '../trainingPaces';

const paces = pacesFromReference(5000, 25 * 60); // corredor de 25min no 5K

describe('buildTemplates', () => {
  const tpls = buildTemplates(paces);

  it('gera vários treinos clássicos', () => {
    expect(tpls.length).toBeGreaterThanOrEqual(6);
  });

  it('cada template é estruturalmente válido', () => {
    for (const t of tpls) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.emoji).toBeTruthy();
      expect(t.segments.length).toBeGreaterThan(0);
      expect(t.segments.every((s) => s.repeats >= 1)).toBe(true);
      expect(t.segments.every((s) => (s.durationSec ?? 0) > 0 || (s.distanceM ?? 0) > 0)).toBe(true);
      expect(Number.isFinite(t.estDurationSec) && t.estDurationSec > 0).toBe(true);
      expect(Number.isFinite(t.estDistanceM) && t.estDistanceM > 0).toBe(true);
    }
  });

  it('ids únicos', () => {
    const ids = tpls.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo treino começa aquecendo e termina com volta calma (exceto o longão)', () => {
    for (const t of tpls) {
      if (t.id === 'long-run') continue;
      expect(t.segments[0].kind).toBe('WARMUP');
      expect(t.segments[t.segments.length - 1].kind).toBe('COOLDOWN');
    }
  });

  it('Yasso 800s tem tiros de 800m', () => {
    const y = tpls.find((t) => t.id === 'yasso-800');
    expect(y).toBeTruthy();
    expect(y!.segments.some((s) => s.distanceM === 800 && s.kind === 'INTERVAL_FAST')).toBe(true);
  });

  it('fartlek alterna forte/recuperação (>=6 de cada)', () => {
    const f = tpls.find((t) => t.id === 'fartlek');
    expect(f).toBeTruthy();
    const kinds = f!.segments.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'INTERVAL_FAST').length).toBeGreaterThanOrEqual(6);
    expect(kinds.filter((k) => k === 'INTERVAL_SLOW').length).toBeGreaterThanOrEqual(6);
  });

  it('pirâmide sobe e desce (tem 800m no pico e 200m nas pontas)', () => {
    const p = tpls.find((t) => t.id === 'pyramid');
    expect(p).toBeTruthy();
    const fastDists = p!.segments.filter((s) => s.kind === 'INTERVAL_FAST').map((s) => s.distanceM);
    expect(fastDists).toContain(800);
    expect(fastDists.filter((d) => d === 200).length).toBeGreaterThanOrEqual(2);
  });

  it('escala pelo pace: corredor mais rápido gasta menos tempo nos mesmos 800m', () => {
    const fast = buildTemplates(pacesFromReference(5000, 18 * 60)); // 18min (elite)
    const slow = buildTemplates(pacesFromReference(5000, 35 * 60)); // 35min
    const yf = fast.find((t) => t.id === 'yasso-800')!;
    const ys = slow.find((t) => t.id === 'yasso-800')!;
    const fdur = yf.segments.find((s) => s.kind === 'INTERVAL_FAST')!.durationSec!;
    const sdur = ys.segments.find((s) => s.kind === 'INTERVAL_FAST')!.durationSec!;
    expect(fdur).toBeLessThan(sdur);
  });

  it('estDuration bate com a soma dos segmentos (± tolerância)', () => {
    const tempo = tpls.find((t) => t.id === 'tempo')!;
    const sum = tempo.segments.reduce((a, s) => a + (s.durationSec ?? 0) * s.repeats, 0);
    expect(Math.abs(tempo.estDurationSec - sum)).toBeLessThanOrEqual(2);
  });
});

describe('templateToWorkoutBody', () => {
  it('produz corpo válido do POST /workouts', () => {
    const body = templateToWorkoutBody(buildTemplates(paces)[0]);
    expect(body.name).toBeTruthy();
    expect(body.type).toBeTruthy();
    expect(Array.isArray(body.segments)).toBe(true);
    expect(body.isTemplate).toBe(false);
  });
});
