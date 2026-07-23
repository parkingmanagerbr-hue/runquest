import { describe, it, expect } from 'vitest';
import { isActive, isImmersive, NAV_ITEMS } from '../nav';

describe('isActive', () => {
  it('marca Início SÓ no match exato de /app (é prefixo de tudo)', () => {
    expect(isActive('/app', '/app')).toBe(true);
    expect(isActive('/app/missions', '/app')).toBe(false);
    expect(isActive('/app/runs/123', '/app')).toBe(false);
  });

  it('marca a aba no match exato', () => {
    expect(isActive('/app/missions', '/app/missions')).toBe(true);
    expect(isActive('/app/leaderboard', '/app/leaderboard')).toBe(true);
  });

  it('marca a aba como prefixo de sub-rota', () => {
    expect(isActive('/app/runs/abc', '/app/runs')).toBe(true);
    expect(isActive('/app/profile/edit', '/app/profile')).toBe(true);
  });

  it('não confunde prefixos que compartilham texto mas não a fronteira /', () => {
    // /app/run vs /app/runs — não deve marcar um pelo outro
    expect(isActive('/app/runs', '/app/run')).toBe(false);
    expect(isActive('/app/running', '/app/run')).toBe(false);
  });
});

describe('isImmersive', () => {
  it('esconde a barra no GPS ao vivo e na execução de treino', () => {
    expect(isImmersive('/app/run')).toBe(true);
    expect(isImmersive('/app/workouts/xyz/play')).toBe(true);
  });

  it('mostra a barra nas telas normais', () => {
    expect(isImmersive('/app')).toBe(false);
    expect(isImmersive('/app/missions')).toBe(false);
    expect(isImmersive('/app/runs/123')).toBe(false);
  });
});

describe('NAV_ITEMS', () => {
  it('tem exatamente uma ação primária (o botão Correr central)', () => {
    expect(NAV_ITEMS.filter((i) => i.primary)).toHaveLength(1);
    expect(NAV_ITEMS.find((i) => i.primary)?.href).toBe('/app/run');
  });

  it('tem 5 abas com hrefs únicos', () => {
    expect(NAV_ITEMS).toHaveLength(5);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(5);
  });
});
