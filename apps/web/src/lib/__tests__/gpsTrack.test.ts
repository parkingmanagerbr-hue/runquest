import { describe, it, expect } from 'vitest';
import { isAcceptableFix, acceptStep, elevationStep, splitPace, gpsSignal, elapsedSec } from '../gpsTrack';

describe('isAcceptableFix — gate de precisão horizontal', () => {
  it('aceita no limiar (35 m) e melhor', () => {
    expect(isAcceptableFix(35)).toBe(true);
    expect(isAcceptableFix(5)).toBe(true);
  });
  it('rejeita acima do limiar', () => {
    expect(isAcceptableFix(35.1)).toBe(false);
    expect(isAcceptableFix(100)).toBe(false);
  });
});

describe('acceptStep — filtro de jitter/teleporte', () => {
  it('rejeita passo parado (< 1.5 m) → null', () => {
    expect(acceptStep(0)).toBeNull();
    expect(acceptStep(1.49)).toBeNull();
  });
  it('rejeita salto de GPS (> 60 m) → null', () => {
    expect(acceptStep(60.1)).toBeNull();
    expect(acceptStep(500)).toBeNull();
  });
  it('aceita passo plausível e retorna a mesma distância', () => {
    expect(acceptStep(1.5)).toBe(1.5);
    expect(acceptStep(10)).toBe(10);
    expect(acceptStep(60)).toBe(60);
  });
});

describe('elevationStep — acumulador de elevação com filtros', () => {
  it('sem altitude anterior → zero', () => {
    expect(elevationStep(null, 100, 5)).toEqual({ gain: 0, loss: 0 });
  });
  it('altitude imprecisa (altAcc ≥ 25) → zero', () => {
    expect(elevationStep(100, 110, 25)).toEqual({ gain: 0, loss: 0 });
    expect(elevationStep(100, 110, 40)).toEqual({ gain: 0, loss: 0 });
  });
  it('altAccuracy nula é tolerada (conta se delta plausível)', () => {
    expect(elevationStep(100, 105, null)).toEqual({ gain: 5, loss: 0 });
  });
  it('ruído pequeno (|delta| ≤ 0.3) → zero', () => {
    expect(elevationStep(100, 100.2, 5)).toEqual({ gain: 0, loss: 0 });
  });
  it('degrau grande demais (|delta| ≥ 30) → zero', () => {
    expect(elevationStep(100, 135, 5)).toEqual({ gain: 0, loss: 0 });
  });
  it('subida acumula em gain; descida em loss', () => {
    expect(elevationStep(100, 108, 5)).toEqual({ gain: 8, loss: 0 });
    expect(elevationStep(108, 100, 5)).toEqual({ gain: 0, loss: 8 });
  });
});

describe('splitPace — pace de um km completado', () => {
  it('2º km em 5min → 300 s/km', () => {
    // de 1000 m/300 s para 2000 m/600 s → 300 s no km → 300 s/km
    expect(splitPace(600, 300, 2000, 1000)).toBe(300);
  });
  it('arredonda ao segundo', () => {
    expect(splitPace(650, 300, 2000, 1000)).toBe(350);
  });
});

describe('gpsSignal — barras de sinal pela precisão', () => {
  it('sem GPS (null/0) → 0 barras', () => {
    expect(gpsSignal(null)).toBe(0);
    expect(gpsSignal(0)).toBe(0);
  });
  it('escala por faixa de precisão (menor = melhor)', () => {
    expect(gpsSignal(3)).toBe(4);   // <= 5 m
    expect(gpsSignal(5)).toBe(4);
    expect(gpsSignal(10)).toBe(3);  // <= 10 m
    expect(gpsSignal(20)).toBe(2);  // <= 20 m
    expect(gpsSignal(40)).toBe(1);  // <= 40 m
  });
  it('precisão pior que 40 m → 0 barras', () => {
    expect(gpsSignal(41)).toBe(0);
    expect(gpsSignal(500)).toBe(0);
  });
});

describe('elapsedSec — relógio (flush ao pausar/parar)', () => {
  it('base + segundos decorridos desde o início do segmento', () => {
    // base 10s, segmento começou em t0, agora t0+5s → 15s.
    expect(elapsedSec(10, 1_000_000, 1_005_000)).toBe(15);
  });
  it('arredonda ao segundo (captura a fração sub-tick que o flush existe p/ salvar)', () => {
    // 10,7s desde o início, base 0 → arredonda p/ 11 (o tick stale daria 10).
    expect(elapsedSec(0, 1_000_000, 1_010_700)).toBe(11);
  });
  it('mesmo instante → só a base (segmento de duração zero)', () => {
    expect(elapsedSec(42, 2_000_000, 2_000_000)).toBe(42);
  });
});
