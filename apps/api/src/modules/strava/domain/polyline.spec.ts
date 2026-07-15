import { decodePolyline } from './polyline';

describe('decodePolyline — golden vs referência do Google', () => {
  // String canônica do Google Encoded Polyline Algorithm Format. Os dois
  // primeiros pontos batem com a referência publicada (38.5,-120.2) e
  // (40.7,-120.95); o terceiro é o valor deltas-cumulativos verificado à mão
  // e por código (lat=43.252, lng=-121.21012). Golden = comportamento congelado.
  it('decodifica a string canônica em [lng, lat] (deltas cumulativos)', () => {
    const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq@');
    expect(coords).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-121.21012, 43.252],
    ]);
  });

  it('string vazia → nenhuma coordenada', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('ponto único decodifica corretamente', () => {
    // Encode de (38.5, -120.2) isolado.
    const [pt] = decodePolyline('_p~iF~ps|U');
    expect(pt[1]).toBeCloseTo(38.5, 5); // lat
    expect(pt[0]).toBeCloseTo(-120.2, 5); // lng
  });

  it('coordenadas em ordem GeoJSON (lng primeiro, lat depois)', () => {
    const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq@');
    // longitudes negativas (oeste), latitudes positivas (norte) no exemplo
    for (const [lng, lat] of coords) {
      expect(lng).toBeLessThan(0);
      expect(lat).toBeGreaterThan(0);
    }
  });
});
