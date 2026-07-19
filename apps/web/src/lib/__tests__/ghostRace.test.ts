import { describe, it, expect } from 'vitest';
import { ghostProgress, leadChangeCallout, finishCallout } from '../ghostRace';

describe('ghostProgress', () => {
  it('fantasma a 5:00/km faz 200m em 60s', () => {
    const g = ghostProgress({ elapsedSec: 60, youMeters: 220, ghostPaceSecPerKm: 300 });
    expect(g.ghostMeters).toBe(200);
    expect(g.gapMeters).toBe(20);
    expect(g.ahead).toBe(true);
    expect(g.gapSec).toBe(6); // 20m a 5:00/km = 6s
  });

  it('atrás do fantasma → gap negativo, ahead false', () => {
    const g = ghostProgress({ elapsedSec: 60, youMeters: 180, ghostPaceSecPerKm: 300 });
    expect(g.gapMeters).toBe(-20);
    expect(g.ahead).toBe(false);
    expect(g.gapSec).toBe(-6);
  });

  it('linha de chegada: você cruza 5k → finished/youFinished', () => {
    const g = ghostProgress({ elapsedSec: 1500, youMeters: 5000, ghostPaceSecPerKm: 300, targetDistanceM: 5000 });
    expect(g.youFinished).toBe(true);
    expect(g.finished).toBe(true);
    expect(g.progress).toBe(1);
  });

  it('fantasma cruza antes de você', () => {
    const g = ghostProgress({ elapsedSec: 1500, youMeters: 4800, ghostPaceSecPerKm: 300, targetDistanceM: 5000 });
    expect(g.ghostFinished).toBe(true);
    expect(g.youFinished).toBe(false);
  });

  it('pace 0 não gera NaN (fantasma parado)', () => {
    const g = ghostProgress({ elapsedSec: 100, youMeters: 300, ghostPaceSecPerKm: 0 });
    expect(g.ghostMeters).toBe(0);
    expect(Number.isFinite(g.gapSec)).toBe(true);
  });

  it('entradas negativas viram 0', () => {
    const g = ghostProgress({ elapsedSec: -5, youMeters: -10, ghostPaceSecPerKm: 300 });
    expect(g.youMeters).toBe(0);
    expect(g.ghostMeters).toBe(0);
  });
});

describe('leadChangeCallout (histerese)', () => {
  const ahead = ghostProgress({ elapsedSec: 60, youMeters: 220, ghostPaceSecPerKm: 300 });
  const behind = ghostProgress({ elapsedSec: 60, youMeters: 180, ghostPaceSecPerKm: 300 });
  const tie = ghostProgress({ elapsedSec: 60, youMeters: 203, ghostPaceSecPerKm: 300 });

  it('ultrapassagem anuncia', () => {
    expect(leadChangeCallout(false, ahead)).toContain('Ultrapassou');
  });
  it('ser ultrapassado anuncia', () => {
    expect(leadChangeCallout(true, behind)).toContain('passou');
  });
  it('dentro da histerese (≈empate) → silêncio', () => {
    expect(leadChangeCallout(true, tie)).toBeNull();
  });
  it('sem estado anterior → silêncio', () => {
    expect(leadChangeCallout(null, ahead)).toBeNull();
  });
  it('mesma liderança → silêncio', () => {
    expect(leadChangeCallout(true, ahead)).toBeNull();
  });
});

describe('finishCallout', () => {
  it('vitória do corredor', () => {
    const g = ghostProgress({ elapsedSec: 1490, youMeters: 5000, ghostPaceSecPerKm: 300, targetDistanceM: 5000 });
    expect(finishCallout(g)).toContain('venceu');
  });
});

describe('finishCallout — os dois lados', () => {
  it('você chegou primeiro → mensagem de vitória', () => {
    const msg = finishCallout({ youMeters: 5000, ghostMeters: 4900, gapMeters: 100, gapSec: 20, ahead: true, finished: true, youFinished: true, ghostFinished: false, progress: 1 });
    expect(msg).toMatch(/venceu/i);
  });
  it('fantasma chegou primeiro → mensagem de revanche', () => {
    const msg = finishCallout({ youMeters: 4900, ghostMeters: 5000, gapMeters: -100, gapSec: -20, ahead: false, finished: true, youFinished: false, ghostFinished: true, progress: 0.98 });
    expect(msg).toMatch(/fantasma chegou primeiro|revanche/i);
  });
});
