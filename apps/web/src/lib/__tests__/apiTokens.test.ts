// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { tokens } from '../api';

beforeEach(() => localStorage.clear());

describe('tokens (sessão)', () => {
  it('save grava access + refresh; hasSession true', () => {
    tokens.save('AT', 'RT');
    expect(localStorage.getItem('rq.at')).toBe('AT');
    expect(localStorage.getItem('rq.rt')).toBe('RT');
    expect(tokens.hasSession()).toBe(true);
  });

  it('clear remove os dois; hasSession false', () => {
    tokens.save('AT', 'RT');
    tokens.clear();
    expect(localStorage.getItem('rq.at')).toBeNull();
    expect(localStorage.getItem('rq.rt')).toBeNull();
    expect(tokens.hasSession()).toBe(false);
  });

  it('sem token → hasSession false', () => {
    expect(tokens.hasSession()).toBe(false);
  });
});
