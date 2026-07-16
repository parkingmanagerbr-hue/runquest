import { describe, it, expect } from 'vitest';
import { parseTargetPace } from '../parsePace';

describe('parseTargetPace', () => {
  it('converte m:ss em segundos/km', () => {
    expect(parseTargetPace('5:30')).toBe(330);
    expect(parseTargetPace('12:00')).toBe(720);
    expect(parseTargetPace('4:05')).toBe(245);
  });

  it('tolera zero à esquerda e espaços', () => {
    expect(parseTargetPace('05:30')).toBe(330);
    expect(parseTargetPace('  5:30 ')).toBe(330);
  });

  it('rejeita segundos inválidos (≥ 60) — não normaliza silenciosamente', () => {
    expect(parseTargetPace('5:75')).toBe(0); // NÃO 6:15
    expect(parseTargetPace('5:60')).toBe(0);
  });

  it('formato inválido → 0 (tratado como "sem alvo")', () => {
    expect(parseTargetPace('5')).toBe(0);
    expect(parseTargetPace('5:3')).toBe(0); // precisa 2 dígitos
    expect(parseTargetPace('')).toBe(0);
    expect(parseTargetPace('abc')).toBe(0);
    expect(parseTargetPace('5:30:00')).toBe(0);
  });
});
