'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, Square, MapPin, Activity, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api, tokens } from '@/lib/api';
import { haversine, formatPace, formatDuration, formatDistance } from '@/lib/geo';

const RunMap = dynamic(() => import('@/components/RunMap').then(m => m.RunMap), {
  ssr: false,
  loading: () => <div className="h-[50vh] bg-rq-night animate-pulse rounded-2xl" />,
});

type Point = [number, number];

export default function RunTrackingPage() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'tracking' | 'paused' | 'done'>('idle');
  const [points, setPoints] = useState<Point[]>([]);
  const [current, setCurrent] = useState<Point | null>(null);
  const [distance, setDistance] = useState(0); // meters
  const [duration, setDuration] = useState(0); // seconds
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchId = useRef<number | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const distRef = useRef(0);

  useEffect(() => {
    if (!tokens.hasSession()) router.replace('/auth/login');
  }, [router]);

  // Initial position
  useEffect(() => {
    if (state !== 'idle') return;
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada nesse navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrent([pos.coords.latitude, pos.coords.longitude]),
      (e) => setError('GPS: ' + e.message),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [state]);

  const start = () => {
    if (!navigator.geolocation) { setError('GPS indisponível'); return; }
    setError(null);
    setPoints([]); pointsRef.current = [];
    setDistance(0); distRef.current = 0;
    setDuration(0);
    setStartedAt(new Date());
    setState('tracking');

    // GPS watcher
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        if (acc > 25) return; // descarta pontos imprecisos
        const p: Point = [pos.coords.latitude, pos.coords.longitude];
        const prev = pointsRef.current[pointsRef.current.length - 1];
        if (prev) {
          const d = haversine(prev, p);
          if (d < 2) return; // ignora ruído < 2m
          if (d > 50) return; // ignora salto > 50m (provável GPS bug)
          distRef.current += d;
          setDistance(distRef.current);
        }
        pointsRef.current.push(p);
        setPoints([...pointsRef.current]);
        setCurrent(p);
      },
      (e) => setError('GPS error: ' + e.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );

    // Duration tick
    tickRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const pause = () => {
    setState('paused');
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const resume = () => start();

  const stop = async () => {
    pause();
    if (pointsRef.current.length < 2) {
      if (!confirm('Corrida muito curta. Descartar?')) return;
      reset();
      return;
    }
    setState('done');
    const startedISO = startedAt!.toISOString();
    const endedISO = new Date(startedAt!.getTime() + duration * 1000).toISOString();
    const pace = distRef.current > 0 ? Math.round((duration * 1000) / distRef.current) : 0;
    try {
      const run = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rq.at')}`,
        },
        body: JSON.stringify({
          startedAt: startedISO,
          endedAt: endedISO,
          distanceMeters: distRef.current,
          durationSec: duration,
          avgPaceSecPerKm: pace,
          pointsGeoJson: {
            type: 'LineString',
            coordinates: pointsRef.current.map(([lat, lng]) => [lng, lat]),
          },
          source: 'GPS',
          opId: `run-${Date.now()}`,
        }),
      }).then(r => r.json());
      router.replace(`/app/runs/${run.id}`);
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    }
  };

  const reset = () => {
    setState('idle');
    setPoints([]); pointsRef.current = [];
    setDistance(0); distRef.current = 0;
    setDuration(0);
    setStartedAt(null);
  };

  const pace = distance > 0 ? Math.round((duration * 1000) / distance) : 0;

  return (
    <main className="min-h-screen bg-rq-aurora flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold">Corrida</h1>
          <div className="ml-auto flex items-center gap-1.5 text-xs">
            <MapPin className="w-3.5 h-3.5 text-rq-lime" />
            <span className="text-white/60">{current ? 'GPS' : '...'}</span>
          </div>
        </div>
      </header>

      <RunMap positions={points} current={current} height="48vh" />

      {error && <div className="bg-rq-orange/20 text-rq-orange px-4 py-2 text-sm text-center">{error}</div>}

      <section className="flex-1 px-6 py-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider">Distância</div>
            <div className="font-display text-4xl font-black tabular-nums">{formatDistance(distance)}</div>
            <div className="text-white/40 text-xs">km</div>
          </div>
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider">Tempo</div>
            <div className="font-display text-4xl font-black tabular-nums">{formatDuration(duration)}</div>
            <div className="text-white/40 text-xs">min</div>
          </div>
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider">Pace</div>
            <div className="font-display text-4xl font-black tabular-nums">{formatPace(pace)}</div>
            <div className="text-white/40 text-xs">min/km</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          {state === 'idle' && (
            <button onClick={start} className="btn-primary text-lg px-10 py-4">
              <Play className="w-5 h-5" /> Iniciar
            </button>
          )}
          {state === 'tracking' && (
            <>
              <button onClick={pause} className="btn-ghost text-lg px-8 py-4">
                <Pause className="w-5 h-5" /> Pausar
              </button>
              <button onClick={stop} className="btn-primary text-lg px-8 py-4 from-rq-orange to-red-500"
                style={{ background: 'linear-gradient(to bottom right, #FF7A1A, #ff3838)' }}>
                <Square className="w-5 h-5" /> Finalizar
              </button>
            </>
          )}
          {state === 'paused' && (
            <>
              <button onClick={resume} className="btn-primary text-lg px-8 py-4">
                <Play className="w-5 h-5" /> Retomar
              </button>
              <button onClick={stop} className="btn-ghost text-lg px-8 py-4">
                <Square className="w-5 h-5" /> Salvar
              </button>
            </>
          )}
          {state === 'done' && (
            <div className="flex items-center gap-2 text-rq-lime">
              <Activity className="w-5 h-5" /> Salvando…
            </div>
          )}
        </div>

        {state === 'idle' && (
          <p className="text-center mt-6 text-xs text-white/40">
            🔒 Permissão de localização será solicitada. Funciona melhor com GPS ativo e céu aberto.
          </p>
        )}
      </section>
    </main>
  );
}
