import { geoJsonCoords } from './geojson';

describe('geoJsonCoords', () => {
  it('extrai as coordenadas de um LineString válido', () => {
    const gj = { type: 'LineString', coordinates: [[-46.6, -23.5], [-46.7, -23.6]] };
    expect(geoJsonCoords(gj)).toEqual([[-46.6, -23.5], [-46.7, -23.6]]);
  });

  it('valor sem coordinates → []', () => {
    expect(geoJsonCoords({})).toEqual([]);
    expect(geoJsonCoords(null)).toEqual([]);
    expect(geoJsonCoords(undefined)).toEqual([]);
    expect(geoJsonCoords('string')).toEqual([]);
    expect(geoJsonCoords({ coordinates: 'nao-array' })).toEqual([]);
  });

  it('descarta pontos malformados — não deixa o GPX quebrar com 500', () => {
    const gj = {
      coordinates: [
        [-46.6, -23.5], // ok
        [-46.7], // curto demais
        ['a', 'b'], // não numérico
        null,
        [NaN, -23.6], // não finito
        [-46.8, -23.7], // ok
      ],
    };
    expect(geoJsonCoords(gj)).toEqual([[-46.6, -23.5], [-46.8, -23.7]]);
  });

  it('lista de coordenadas vazia → []', () => {
    expect(geoJsonCoords({ coordinates: [] })).toEqual([]);
  });
});
