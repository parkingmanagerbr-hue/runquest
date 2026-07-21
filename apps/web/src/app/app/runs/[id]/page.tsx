'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Clock, MapPin, TrendingUp, Upload, Sparkles, Download, Flame, Gauge, Mountain, StickyNote, Check } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { formatDistance, formatDuration, formatPace, computeSplits } from '@/lib/geo';
import { Share2, ImageDown } from 'lucide-react';
import { buildRunCardSvg } from '@/lib/runCard';
import { estimateCalories } from '@/lib/calories';

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
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  avgSpeedKmh?: number | null;
  notes?: string | null;
}

/** Rasteriza um SVG (string) em PNG via canvas — só no cliente. */
function svgToPng(svg: string, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no ctx')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')); };
    img.src = url;
  });
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    // Try direct endpoint first (faster), fall back to list search.
    // `.catch(() => null)` reproduz o antigo `r.ok ? r.json() : null`, mantendo o fallback.
    api.get<Run | null>(`/runs/${id}`)
      .catch(() => null)
      .then(async (run) => {
        if (run?.id) { setRun(run); if (run.notes) setNotes(run.notes); return; }
        // Fallback: search in list
        const runs = await api.get<Run[]>('/runs?limit=100');
        const found = runs.find(r => r.id === id) ?? null;
        setRun(found);
        if (found?.notes) setNotes(found.notes);
      })
      .catch(() => setRun(null)) // fallback também falhou — mostra "não encontrada"
      .finally(() => setLoading(false));
  }, [id, router]);

  const analyzeRun = async () => {
    setAnalyzing(true);
    try {
      // A API responde 200 com { analysis: null, premium: false } p/ não-premium,
      // então o api.post não lança nesse caso — comportamento idêntico.
      const r = await api.post<{ analysis?: string | null; premium?: boolean; error?: string }>(
        `/runs/${id}/analyze`,
      );
      if (r.analysis) setAnalysis(r.analysis);
      else if (!r.premium) setAnalysis('💎 Análise IA disponível para assinantes Premium');
      // Premium, mas a IA falhou: mostra erro real em vez do upsell de Premium.
      else setAnalysis('Não consegui gerar a análise agora. Tente de novo em instantes.');
    } catch (e) { setAnalysis('Erro: ' + (e instanceof Error ? e.message : String(e))); }
    setAnalyzing(false);
  };

  const exportStrava = async () => {
    try {
      // NÃO migrar para o cliente `api`: 401 aqui significa "Strava não conectado",
      // não sessão expirada — o api.request mandaria o usuário pro login.
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/strava/export/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      }).then(r => r.json());
      alert(`Enviado pro Strava (upload #${r.uploadId})`);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  if (loading) return <main className="min-h-screen flex items-center justify-center text-white/60">Carregando…</main>;
  if (!run) return <main className="min-h-screen flex items-center justify-center text-white/60">Corrida não encontrada.</main>;

  // Convert coordinates from GeoJSON [lng,lat] to Leaflet [lat,lng]
  const positions: [number, number][] = (run.pointsGeoJson?.coordinates ?? [])
    .map((c) => [c[1], c[0]] as [number, number]);

  const date = new Date(run.startedAt);
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // User weight for calorie calculation
  const weightKg = (() => {
    try { const s = JSON.parse(localStorage.getItem('rq.settings') ?? '{}'); return s.weightKg || 70; }
    catch { return 70; }
  })();

  // Splits reais por km — só possíveis se a corrida tiver um timestamp por
  // ponto. As corridas atuais gravam só [lng,lat], então isto cai no fallback
  // honesto abaixo (pace médio). Antes, a função FABRICAVA a variação a partir
  // da densidade de pontos do GPS e o usuário via splits que nunca existiram.
  const rawSplits = computeSplits(run.pointsGeoJson?.coordinates ?? [], run.durationSec);
  const splits = rawSplits.length > 0 ? rawSplits : (() => {
    // Fallback: pace médio uniforme (o único número defensável sem timestamps)
    const totalKm = Math.floor(run.distanceMeters / 1000);
    return Array.from({ length: totalKm }, (_, i) => ({ km: i + 1, paceSecPerKm: run.avgPaceSecPerKm }));
  })();
  const maxPace = Math.max(...splits.map(s => s.paceSecPerKm), 1);
  const minPace = Math.min(...splits.map(s => s.paceSecPerKm), 1);
  const paceRange = maxPace - minPace || 1;

  const share = async () => {
    const publicUrl = `${window.location.origin}/runs/${run.id}`;
    const text = `Corri ${formatDistance(run.distanceMeters)}km em ${formatDuration(run.durationSec)} (pace ${formatPace(run.avgPaceSecPerKm)}/km) 🏃‍♂️`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'RunQuest', text, url: publicUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text + '\n' + publicUrl);
      alert('Link copiado!');
    }
  };

  // Gera o card visual (SVG → PNG) e compartilha/baixa como imagem.
  const shareCard = async () => {
    if (!run) return;
    setCardBusy(true);
    try {
      const svg = buildRunCardSvg({
        coordinates: run.pointsGeoJson?.coordinates ?? [],
        distanceMeters: run.distanceMeters,
        durationSec: run.durationSec,
        avgPaceSecPerKm: run.avgPaceSecPerKm,
        dateLabel: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
        elevationGainM: run.elevationGainM,
        title: date.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase()),
      });
      const blob = await svgToPng(svg, 1080, 1350);
      const file = new File([blob], `runquest-${run.id}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'RunQuest', text: `Corri ${formatDistance(run.distanceMeters)} km 🏃‍♂️` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      alert('Não consegui gerar o card. Tente de novo.');
    } finally {
      setCardBusy(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.patch(`/runs/${run.id}/notes`, { notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {}
    setSavingNotes(false);
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold capitalize">{dateStr} · {timeStr}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={shareCard} disabled={cardBusy} className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-50">
              <ImageDown className="w-3.5 h-3.5" /> {cardBusy ? 'Gerando…' : 'Card'}
            </button>
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
              {(() => { const displayKmh = run.avgSpeedKmh ?? parseFloat(((run.distanceMeters / run.durationSec) * 3.6).toFixed(1)); return displayKmh.toFixed(1); })()}
            </div>
            <div className="text-xs text-white/50">km/h</div>
          </div>
          <div className="glass p-4">
            <Flame className="w-4 h-4 text-rq-orange mb-1" />
            <div className="font-display text-xl font-black">
              {estimateCalories(run.distanceMeters, weightKg)}
            </div>
            <div className="text-xs text-white/50">kcal est.</div>
          </div>
          {(run.elevationGainM || run.elevationLossM) && (
            <div className="glass p-3 text-center">
              <Mountain className="w-4 h-4 text-rq-lime mx-auto mb-0.5" />
              <div className="font-display text-lg font-black text-rq-lime tabular-nums">
                +{Math.round(run.elevationGainM ?? 0)}m
              </div>
              <div className="text-xs text-white/50">elevação</div>
              {(run.elevationLossM ?? 0) > 0 && (
                <div className="text-xs text-white/30">-{Math.round(run.elevationLossM!)}m</div>
              )}
            </div>
          )}
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

        {/* Personal notes */}
        <div className="glass p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/60 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-rq-gold" /> Notas pessoais
            </h2>
            <button onClick={saveNotes} disabled={savingNotes}
              className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                notesSaved ? 'text-rq-lime' : 'btn-ghost text-white/60'
              }`}>
              {notesSaved ? <><Check className="w-3 h-3" /> Salvo!</> : savingNotes ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={notes !== (run.notes ?? '') ? saveNotes : undefined}
            rows={3}
            placeholder="Como foi essa corrida? Clima, como se sentiu, objetivos…"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 resize-none text-sm text-white/80 placeholder-white/30 focus:border-rq-gold/40 focus:outline-none transition"
          />
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
