'use client';
import dynamic from 'next/dynamic';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Clock, MapPin, TrendingUp, Trash2, Upload } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDistance, formatDuration, formatPace } from '@/lib/geo';

const RunMap = dynamic(() => import('@/components/RunMap').then(m => m.RunMap), { ssr: false });

interface Run {
  id: string;
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  pointsGeoJson?: { type?: string; coordinates?: number[][]; polyline?: string };
  source: string;
  stravaActivityId?: string | null;
  stravaUploadId?: string | null;
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    })
      .then(r => r.json())
      .then((runs: Run[]) => {
        const found = runs.find(r => r.id === id);
        setRun(found ?? null);
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const exportStrava = async () => {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/strava/export/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      }).then(r => r.json());
      alert(`Enviado pro Strava (upload #${r.uploadId})`);
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <main className="min-h-screen flex items-center justify-center text-white/60">Carregando…</main>;
  if (!run) return <main className="min-h-screen flex items-center justify-center text-white/60">Corrida não encontrada.</main>;

  // Convert coordinates from GeoJSON [lng,lat] to Leaflet [lat,lng]
  const positions: [number, number][] = (run.pointsGeoJson?.coordinates ?? [])
    .map((c) => [c[1], c[0]] as [number, number]);

  const date = new Date(run.startedAt);
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Splits per km (estimativa baseada em pace médio + pontos)
  const splits: { km: number; pace: string }[] = [];
  if (run.distanceMeters > 1000) {
    const totalKm = Math.floor(run.distanceMeters / 1000);
    for (let k = 1; k <= totalKm; k++) splits.push({ km: k, pace: formatPace(run.avgPaceSecPerKm) });
  }

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold capitalize">{dateStr} · {timeStr}</h1>
          <div className="ml-auto flex items-center gap-2">
            {!run.stravaUploadId && (
              <button onClick={exportStrava} className="btn-ghost text-xs py-1.5 px-3">
                <Upload className="w-3.5 h-3.5" /> Enviar Strava
              </button>
            )}
            {run.stravaUploadId && <span className="text-rq-lime text-xs">✓ no Strava</span>}
          </div>
        </div>
      </header>

      {positions.length > 1 && <RunMap positions={positions} current={null} height="40vh" />}

      <section className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="glass p-4">
            <Activity className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-2xl font-black">{formatDistance(run.distanceMeters)}</div>
            <div className="text-xs text-white/50">km</div>
          </div>
          <div className="glass p-4">
            <Clock className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-2xl font-black tabular-nums">{formatDuration(run.durationSec)}</div>
            <div className="text-xs text-white/50">tempo</div>
          </div>
          <div className="glass p-4">
            <TrendingUp className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-2xl font-black tabular-nums">{formatPace(run.avgPaceSecPerKm)}</div>
            <div className="text-xs text-white/50">pace médio</div>
          </div>
          <div className="glass p-4">
            <MapPin className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-2xl font-black">{positions.length}</div>
            <div className="text-xs text-white/50">pontos GPS</div>
          </div>
        </div>

        {splits.length > 0 && (
          <div className="glass p-5">
            <h2 className="font-bold mb-3 text-sm uppercase tracking-wider text-white/60">Splits por km</h2>
            <div className="space-y-1">
              {splits.map(s => (
                <div key={s.km} className="flex items-center gap-3">
                  <div className="w-8 text-right font-mono text-white/60">{s.km}</div>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rq-lime to-rq-emerald" style={{ width: '100%' }} />
                  </div>
                  <div className="tabular-nums font-medium text-rq-lime">{s.pace}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
