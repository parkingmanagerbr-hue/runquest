'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';

interface Territory {
  h3: string;
  visits: number;
  captured: boolean;
  boundary: [number, number][];
}

export function TerritoryMap({ territories, height = '60vh' }: { territories: Territory[]; height?: string }) {
  // Center = centroid do primeiro território ou São Paulo default
  let center: [number, number] = [-23.5505, -46.6333];
  if (territories.length > 0) {
    const t = territories[0];
    const lats = t.boundary.map(b => b[0]);
    const lngs = t.boundary.map(b => b[1]);
    center = [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
  }

  return (
    <div style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='© OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {territories.map(t => (
          <Polygon
            key={t.h3}
            positions={t.boundary}
            pathOptions={{
              color: t.captured ? '#A8FF3E' : '#FFE15A',
              fillColor: t.captured ? '#A8FF3E' : '#FFE15A',
              fillOpacity: t.captured ? 0.45 : 0.18,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ color: '#0E0A2A' }}>
                <strong>{t.captured ? '🏆 Conquistado' : '⚪ Contestado'}</strong>
                <br />
                Visitas: {t.visits}
                <br />
                <code style={{ fontSize: 10 }}>{t.h3}</code>
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  );
}
