import { describe, it, expect } from 'vitest';
import { parseRscMeasurement } from '../useCadence';

const mkBuf = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe('parseRscMeasurement (BLE Running Speed & Cadence)', () => {
  it('caso base: velocidade 3.5 m/s, cadência 170, walking', () => {
    // speedRaw = 3.5*256 = 896 = 0x0380 → LE 0x80,0x03
    const r = parseRscMeasurement(mkBuf([0x00, 0x80, 0x03, 170]));
    expect(r.speedMs).toBe(3.5);
    expect(r.cadenceSpm).toBe(170);
    expect(r.running).toBe(false);
    expect(r.strideLengthM).toBeNull();
    expect(r.totalDistanceM).toBeNull();
  });

  it('flags completas: running + stride 1.2m + distância 50.3m', () => {
    // flags 0x07; speed 0x0200=512/256=2; cadence 180; stride 120cm; dist 503(=50.3m)
    const r = parseRscMeasurement(mkBuf([0x07, 0x00, 0x02, 180, 0x78, 0x00, 0xF7, 0x01, 0x00, 0x00]));
    expect(r.running).toBe(true);
    expect(r.strideLengthM).toBe(1.2);
    expect(r.totalDistanceM).toBe(50.3);
    expect(r.speedMs).toBe(2);
    expect(r.cadenceSpm).toBe(180);
  });

  it('buffer curto (<4 bytes) → tudo null, sem crash', () => {
    const r = parseRscMeasurement(mkBuf([0x00, 0x01]));
    expect(r.speedMs).toBeNull();
    expect(r.cadenceSpm).toBeNull();
    expect(r.running).toBeNull();
  });

  it('cadência 0 → null (sensor sem passo)', () => {
    expect(parseRscMeasurement(mkBuf([0x00, 0x00, 0x00, 0])).cadenceSpm).toBeNull();
  });

  it('flag stride sem bytes suficientes → null, sem crash', () => {
    const r = parseRscMeasurement(mkBuf([0x01, 0x00, 0x01, 160]));
    expect(r.strideLengthM).toBeNull();
    expect(r.cadenceSpm).toBe(160);
  });
});
