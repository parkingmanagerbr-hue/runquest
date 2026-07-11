// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { saveActiveRun, loadActiveRun, clearActiveRun } from '../runPersistence';

const valid = {
  startedAt: new Date().toISOString(),
  points: [[-23.55, -46.63], [-23.549, -46.63]] as [number, number][],
  distance: 500,
  duration: 180,
  elevGain: 10,
  elevLoss: 5,
  targetPace: 300,
};

beforeEach(() => localStorage.clear());

describe('runPersistence', () => {
  it('roundtrip: salva e recupera', () => {
    saveActiveRun(valid);
    const r = loadActiveRun();
    expect(r).not.toBeNull();
    expect(r!.distance).toBe(500);
    expect(r!.points.length).toBe(2);
    expect(typeof r!.savedAt).toBe('number');
  });

  it('rejeita corrida muito curta (<50m)', () => {
    saveActiveRun({ ...valid, distance: 20 });
    expect(loadActiveRun()).toBeNull();
  });

  it('rejeita menos de 2 pontos', () => {
    saveActiveRun({ ...valid, points: [[-23.55, -46.63]] as [number, number][] });
    expect(loadActiveRun()).toBeNull();
  });

  it('rejeita corrida velha (>6h)', () => {
    // grava direto com savedAt de 7h atrás
    const old = { ...valid, savedAt: Date.now() - 7 * 3600 * 1000 };
    localStorage.setItem('rq.activeRun', JSON.stringify(old));
    expect(loadActiveRun()).toBeNull();
  });

  it('load em storage vazio → null', () => {
    expect(loadActiveRun()).toBeNull();
  });

  it('clearActiveRun remove', () => {
    saveActiveRun(valid);
    clearActiveRun();
    expect(loadActiveRun()).toBeNull();
  });

  it('JSON corrompido → null, sem lançar', () => {
    localStorage.setItem('rq.activeRun', '{corrompido');
    expect(loadActiveRun()).toBeNull();
  });
});
