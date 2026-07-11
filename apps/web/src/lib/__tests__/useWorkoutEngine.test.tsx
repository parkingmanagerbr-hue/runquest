// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkoutEngine, expandSegments, type RawSegment } from '../useWorkoutEngine';

/**
 * Regressão do bug crítico: no modo controlado, ao chegar em r<=0 o loop RAF
 * chamava advance() sem reagendar, e como running/advance não mudavam o efeito
 * não re-executava → a contagem congelava no 2º bloco. A correção adiciona `idx`
 * às deps do efeito. Este teste dirige RAF + Date.now manualmente e prova que o
 * idx avança por TODOS os blocos.
 */

let rafCbs: FrameRequestCallback[] = [];
let now = 0;

beforeEach(() => {
  rafCbs = [];
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafCbs.push(cb); return rafCbs.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => vi.restoreAllMocks());

function pump() {
  const cbs = rafCbs;
  rafCbs = [];
  cbs.forEach((cb) => cb(now));
}

const segs: RawSegment[] = [
  { id: 'a', order: 0, kind: 'INTERVAL_FAST', durationSec: 5, repeats: 1 },
  { id: 'b', order: 1, kind: 'INTERVAL_SLOW', durationSec: 5, repeats: 1 },
  { id: 'c', order: 2, kind: 'COOLDOWN', durationSec: 5, repeats: 1 },
];

describe('expandSegments', () => {
  it('expande repeats em passos lineares', () => {
    const steps = expandSegments([{ id: 'x', order: 0, kind: 'INTERVAL_FAST', durationSec: 30, repeats: 4 }]);
    expect(steps.length).toBe(4);
    expect(steps[3].isLastRep).toBe(true);
    expect(steps[0].isLastRep).toBe(false);
  });
});

describe('useWorkoutEngine — loop RAF avança por todos os blocos (regressão #1)', () => {
  it('idx progride 0→1→2 e termina (não congela no 2º bloco)', () => {
    const { result, rerender } = renderHook(
      ({ run }: { run: boolean }) => useWorkoutEngine(segs, { controlledRunning: run }),
      { initialProps: { run: false } },
    );

    // Estado inicial: 3 passos, idx 0, remaining = duração do 1º bloco.
    expect(result.current.steps.length).toBe(3);
    expect(result.current.idx).toBe(0);
    expect(result.current.remaining).toBe(5);

    // Começa (como o app faz: idle → tracking).
    act(() => rerender({ run: true }));

    // +6s → 1º bloco termina → deve avançar pro bloco 1 (ANTES da correção: ficava em 0).
    act(() => { now += 6000; pump(); });
    expect(result.current.idx).toBe(1);

    // +6s → bloco 2 termina → bloco 2 (idx 2).
    act(() => { now += 6000; pump(); });
    expect(result.current.idx).toBe(2);

    // +6s → último bloco termina → done.
    act(() => { now += 6000; pump(); });
    expect(result.current.done).toBe(true);
  });

  it('conta o tempo regressivamente dentro de um bloco (âncora wall-clock)', () => {
    const { result, rerender } = renderHook(
      ({ run }: { run: boolean }) => useWorkoutEngine(segs, { controlledRunning: run }),
      { initialProps: { run: false } },
    );
    act(() => rerender({ run: true }));
    act(() => { now += 2000; pump(); }); // 2s no bloco de 5s
    expect(result.current.remaining).toBe(3);
    expect(result.current.idx).toBe(0);
  });
});
