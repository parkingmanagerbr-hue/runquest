'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';

/**
 * Marcador de posição CSS puro (divIcon) — evita baixar 3 imagens do unpkg.com
 * que o Leaflet usa por padrão (falham offline / com sinal ruim, justamente
 * quando um app de corrida mais precisa do mapa). É um ponto lime da marca com
 * halo, mais bonito que o pino padrão. Criado client-side (RunMap é ssr:false).
 */
function useRunnerIcon() {
  return useMemo(
    () =>
      L.divIcon({
        className: '',
        html:
          '<div style="width:16px;height:16px;border-radius:9999px;background:#A8FF3E;' +
          'border:2px solid #0E0A2A;box-shadow:0 0 0 4px rgba(168,255,62,.25),0 0 10px rgba(168,255,62,.7)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    [],
  );
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
  const icon = useRunnerIcon();
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
        {current && <Marker position={current} icon={icon} />}
        {current && <FollowMap pos={current} />}
      </MapContainer>
    </div>
  );
}
