'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import { useEffect, useState } from 'react';
import type { LatLng } from '@/lib/routePlanner';

function ClickCapture({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export function RouteDrawMap({
  points,
  onAdd,
  height = '52vh',
}: {
  points: LatLng[];
  onAdd: (p: LatLng) => void;
  height?: string;
}) {
  // Centro inicial: posição do usuário se disponível, senão SP.
  const [center, setCenter] = useState<LatLng>([-23.5505, -46.6333]);
  const [located, setLocated] = useState(false);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => { setCenter([p.coords.latitude, p.coords.longitude]); setLocated(true); },
      () => setLocated(true),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  if (!located && points.length === 0) {
    return <div style={{ height }} className="bg-rq-night animate-pulse rounded-2xl" />;
  }

  return (
    <div style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <MapContainer center={points[0] ?? center} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onAdd={onAdd} />
        {points.length > 1 && (
          <Polyline positions={points} pathOptions={{ color: '#A8FF3E', weight: 5, opacity: 0.9, dashArray: '1 8' }} />
        )}
        {points.map((p, i) => (
          <CircleMarker key={i} center={p} radius={i === 0 ? 7 : 5}
            pathOptions={{ color: i === 0 ? '#A8FF3E' : '#3DD68C', fillColor: i === 0 ? '#A8FF3E' : '#3DD68C', fillOpacity: 0.9 }} />
        ))}
      </MapContainer>
    </div>
  );
}
