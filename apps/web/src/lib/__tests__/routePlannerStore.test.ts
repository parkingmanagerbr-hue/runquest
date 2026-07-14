// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { saveRoute, loadRoutes, deleteRoute, type LatLng } from '../routePlanner';

const pts: LatLng[] = [[-23.55, -46.63], [-23.549, -46.63], [-23.548, -46.63]];

beforeEach(() => localStorage.clear());

describe('routePlanner — persistência local', () => {
  it('storage vazio → []', () => {
    expect(loadRoutes()).toEqual([]);
  });

  it('save grava com id, distância e createdAt; load recupera', () => {
    const r = saveRoute('Volta do parque', pts);
    expect(r.id).toMatch(/^rt-/);
    expect(r.distanceM).toBeGreaterThan(0);
    expect(r.createdAt).toBeTruthy();
    const all = loadRoutes();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Volta do parque');
  });

  it('nome vazio → "Percurso"', () => {
    expect(saveRoute('', pts).name).toBe('Percurso');
  });

  it('mais recente primeiro; cap de 50', () => {
    for (let i = 0; i < 55; i++) saveRoute(`R${i}`, pts);
    const all = loadRoutes();
    expect(all.length).toBe(50);
    expect(all[0].name).toBe('R54'); // último salvo no topo
  });

  it('deleteRoute remove por id', () => {
    const a = saveRoute('A', pts);
    saveRoute('B', pts);
    deleteRoute(a.id);
    const all = loadRoutes();
    expect(all.find((r) => r.id === a.id)).toBeUndefined();
    expect(all.length).toBe(1);
  });

  it('JSON corrompido → [] (sem lançar)', () => {
    localStorage.setItem('rq.routes', '{corrompido');
    expect(loadRoutes()).toEqual([]);
  });
});
