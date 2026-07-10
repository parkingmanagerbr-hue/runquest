'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix Leaflet default icons in Next/Webpack
if (typeof window !== 'undefined') {
  // @ts-expect-error — _getIconUrl é interno do Leaflet, sem tipo público
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function FollowMap({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, map.getZoom(), { animate: true });
  }, [pos, map]);
  return null;
}

export function RunMap({
  positions,
  current,
  height = '50vh',
  zoom = 16,
}: {
  positions: [number, number][];
  current: [number, number] | null;
  height?: string;
  zoom?: number;
}) {
  const center = current || positions[positions.length - 1] || [-23.5505, -46.6333];
  return (
    <div style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 1 && (
          <Polyline positions={positions} pathOptions={{ color: '#A8FF3E', weight: 5, opacity: 0.9 }} />
        )}
        {current && <Marker position={current} />}
        {current && <FollowMap pos={current} />}
      </MapContainer>
    </div>
  );
}
