'use client';
import dynamic from 'next/dynamic';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Clock, MapPin, TrendingUp, Upload, Sparkles, Download, Flame, Gauge } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDistance, formatDuration, formatPace, computeSplits } from '@/lib/geo';
import { Share2 } from 'lucide-react';

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
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` } };
    // Try direct endpoint first (faster), fall back to list search
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs/${id}`, h)
      .then(r => r.ok ? r.json() : null)
      .then(async (run: Run | null) => {
        if (run?.id) { setRun(run); return; }
        // Fallback: search in list
        const runs: Run[] = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs?limit=100`, h).then(r => r.json());
        setRun(runs.find(r => r.id === id) ?? null);
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const analyzeRun = async () => {
    setAnalyzing(true);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs/${id}/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      }).then(r => r.json());
      if (r.analysis) setAnalysis(r.analysis);
      else if (!r.premium) setAnalysis('💎 Análise IA disponível para assinantes Premium');
    } catch (e: any) { setAnalysis('Erro: ' + e.message); }
    setAnalyzing(false);
  };

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

  // Splits per km (calculados das coordenadas reais)
  const rawSplits = computeSplits(run.pointsGeoJson?.coordinates ?? [], run.durationSec);
  const splits = rawSplits.length > 0 ? rawSplits : (() => {
    // Fallback: pace médio uniforme
    const totalKm = Math.floor(run.distanceMeters / 1000);
    return Array.from({ length: totalKm }, (_, i) => ({ km: i + 1, paceSecPerKm: run.avgPaceSecPerKm }));
  })();
  const maxPace = Math.max(...splits.map(s => s.paceSecPerKm), 1);
  const minPace = Math.min(...splits.map(s => s.paceSecPerKm), 1);
  const paceRange = maxPace - minPace || 1;

  const share = async () => {
    const text = `Corri ${formatDistance(run.distanceMeters)}km em ${formatDuration(run.durationSec)} (pace ${formatPace(run.avgPaceSecPerKm)}/km) com o RunQuest 🏃‍♂️`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RunQuest',
          text,
          url: window.location.href,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text + '\n' + window.location.href);
      alert('Copiado!');
    }
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold capitalize">{dateStr} · {timeStr}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={share} className="btn-ghost text-xs py-1.5 px-3">
              <Share2 className="w-3.5 h-3.5" /> Compartilhar
            </button>
            <a href={`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs/${id}/gpx`}
              download className="btn-ghost text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              style={{ cursor: 'pointer' }}>
              <Download className="w-3.5 h-3.5" /> GPX
            </a>
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
        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          <div className="glass p-4">
            <Activity className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-xl font-black">{formatDistance(run.distanceMeters)}</div>
            <div className="text-xs text-white/50">km</div>
          </div>
          <div className="glass p-4">
            <Clock className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-xl font-black tabular-nums">{formatDuration(run.durationSec)}</div>
            <div className="text-xs text-white/50">tempo</div>
          </div>
          <div className="glass p-4">
            <TrendingUp className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-xl font-black tabular-nums">{formatPace(run.avgPaceSecPerKm)}</div>
            <div className="text-xs text-white/50">pace médio</div>
          </div>
          <div className="glass p-4">
            <Gauge className="w-4 h-4 text-rq-violet mb-1" />
            <div className="font-display text-xl font-black tabular-nums">
              {(3600 / run.avgPaceSecPerKm).toFixed(1)}
            </div>
            <div className="text-xs text-white/50">km/h</div>
          </div>
          <div className="glass p-4">
            <Flame className="w-4 h-4 text-rq-orange mb-1" />
            <div className="font-display text-xl font-black">
              {Math.round(run.distanceMeters / 1000 * 70 * 1.036)}
            </div>
            <div className="text-xs text-white/50">kcal est.</div>
          </div>
          <div className="glass p-4">
            <MapPin className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-xl font-black">{positions.length}</div>
            <div className="text-xs text-white/50">pts GPS</div>
          </div>
        </div>

        {/* AI Coach Analysis */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rq-lime" /> Análise do Coach IA
            </h2>
            {!analysis && (
              <button onClick={analyzeRun} disabled={analyzing}
                className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
                {analyzing ? '✨ Analisando…' : '✨ Analisar'}
              </button>
            )}
          </div>
          {analysis
            ? <p className="text-sm text-white/80 leading-relaxed">{analysis}</p>
            : <p className="text-sm text-white/40">Toque em Analisar para receber feedback personalizado do seu coach IA.</p>}
        </div>

        {splits.length > 0 && (
          <div className="glass p-5">
            <h2 className="font-bold mb-4 text-sm uppercase tracking-wider text-white/60">Splits por km</h2>
            <div className="space-y-1.5">
              {splits.map(s => {
                // largura proporcional inversa ao pace (mais rápido = barra maior)
                const norm = paceRange > 0 ? 1 - (s.paceSecPerKm - minPace) / paceRange : 1;
                const widthPct = 40 + norm * 60;
                const isFastest = s.paceSecPerKm === minPace;
                const isSlowest = s.paceSecPerKm === maxPace;
                return (
                  <div key={s.km} className="flex items-center gap-3">
                    <div className="w-8 text-right font-mono text-white/50 text-sm">{s.km}</div>
                    <div className="flex-1 h-6 rounded bg-white/5 overflow-hidden relative">
                      <div className={`h-full ${isFastest ? 'bg-gradient-to-r from-rq-lime to-rq-emerald' : isSlowest ? 'bg-gradient-to-r from-rq-orange to-amber-500' : 'bg-gradient-to-r from-rq-emerald/60 to-rq-lime/60'}`} style={{ width: `${widthPct}%` }} />
                    </div>
                    <div className="w-16 text-right tabular-nums font-medium text-rq-lime">{formatPace(s.paceSecPerKm)}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 pt-3 border-t border-white/5 text-xs text-white/50">
              <span>🟢 +rápido: {formatPace(minPace)}/km</span>
              <span>🟠 +lento: {formatPace(maxPace)}/km</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
