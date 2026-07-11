import { describe, it, expect } from 'vitest';
import { bleCharacteristicValue } from '../bluetooth';

describe('bleCharacteristicValue', () => {
  it('extrai o DataView de e.target.value', () => {
    const dv = new DataView(new Uint8Array([1, 2, 3]).buffer);
    const e = { target: { value: dv } } as unknown as Event;
    expect(bleCharacteristicValue(e)).toBe(dv);
  });

  it('sem target → null', () => {
    expect(bleCharacteristicValue({ target: null } as unknown as Event)).toBeNull();
  });

  it('target sem value → null', () => {
    expect(bleCharacteristicValue({ target: {} } as unknown as Event)).toBeNull();
  });
});
