import { describe, it, expect, afterEach, vi } from 'vitest';
import { haptic, TAP, SUCCESS } from '../haptics';

const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'navigator', original);
  else delete (globalThis as { navigator?: unknown }).navigator;
});

describe('haptic', () => {
  it('vibra com o padrão pedido quando a API existe', () => {
    const vibrate = vi.fn(() => true);
    setNavigator({ vibrate });
    expect(haptic(SUCCESS)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(SUCCESS);
  });

  it('usa o toque curto como padrão', () => {
    const vibrate = vi.fn(() => true);
    setNavigator({ vibrate });
    haptic();
    expect(vibrate).toHaveBeenCalledWith(TAP);
  });

  it('degrada silenciosamente onde a API não existe (iOS Safari, desktop)', () => {
    setNavigator({});
    expect(haptic()).toBe(false);
  });

  it('não propaga erro se a chamada lançar', () => {
    setNavigator({ vibrate: () => { throw new Error('bloqueado sem gesto do usuário'); } });
    expect(haptic()).toBe(false);
  });

  it('trata retorno falsy do browser como não-vibrado', () => {
    setNavigator({ vibrate: () => false });
    expect(haptic()).toBe(false);
  });
});
