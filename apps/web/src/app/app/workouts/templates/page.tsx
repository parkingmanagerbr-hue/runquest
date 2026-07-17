'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Dumbbell, MapPin, Play } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { formatPace, formatDuration, formatDistance } from '@/lib/geo';
import { estimatePaces, ZONE_LABEL, type RunLite } from '@/lib/trainingPaces';
import { buildTemplates, templateToWorkoutBody, type WorkoutTemplate } from '@/lib/workoutTemplates';


export default function WorkoutTemplatesPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunLite[]>([]);
  const [manualTime, setManualTime] = useState('');
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.get<RunLite[] | { items?: RunLite[] }>('/runs?limit=100')
      .then((d) => {
        const arr: RunLite[] = Array.isArray(d) ? d : (d?.items ?? []);
        setRuns(arr.map((r) => ({ distanceMeters: r.distanceMeters, durationSec: r.durationSec, startedAt: r.startedAt })));
      })
      .catch(() => {});
  }, [router]);

  const paces = useMemo(() => {
    const fromRuns = estimatePaces(runs, Date.now());
    if (fromRuns.source === 'runs') return fromRuns;
    const m = manualTime.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const sec = parseInt(m[1]) * 60 + parseInt(m[2]);
      if (sec > 600) return estimatePaces([{ distanceMeters: 5000, durationSec: sec, startedAt: new Date().toISOString() }], Date.now());
    }
    return fromRuns;
  }, [runs, manualTime]);

  const templates = useMemo(() => buildTemplates(paces), [paces]);
  const hasFitness = paces.source !== 'none';

  async function launch(t: WorkoutTemplate, mode: 'gps' | 'player') {
    setLaunching(t.id + mode);
    try {
      const w = await api.post<{ id: string }>('/workouts', templateToWorkoutBody(t));
      if (!w?.id) throw new Error('sem id');
      router.push(mode === 'gps' ? `/app/run?workout=${w.id}` : `/app/workouts/${w.id}/play`);
    } catch {
      setLaunching(null);
      alert('Não consegui criar o treino. Tente de novo.');
    }
  }

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app/workouts" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-rq-lime" /> Treinos Clássicos
          </h1>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="glass p-4 text-sm text-white/60 border-rq-lime/20 bg-rq-lime/5">
          <strong className="text-white">As sessões lendárias, no SEU ritmo.</strong>{' '}
          {hasFitness
            ? <>Calibradas nas suas zonas de treino a partir das suas corridas.</>
            : <>Informe um tempo recente de 5K para calibrar nas suas zonas:</>}
        </div>

        {!hasFitness && (
          <div className="glass p-4">
            <input value={manualTime} onChange={(e) => setManualTime(e.target.value)} placeholder="ex.: 27:30"
              className="w-40 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-center font-mono" />
            <span className="text-white/40 text-xs ml-2">mm:ss no 5K</span>
          </div>
        )}

        {hasFitness && (
          <div className="glass p-4">
            <div className="text-[11px] text-white/40 uppercase tracking-wider mb-2">Suas zonas</div>
            <div className="flex flex-wrap gap-2">
              {(['interval', 'threshold', 'marathon', 'easy'] as const).map((z) => (
                <span key={z} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                  {ZONE_LABEL[z]} <span className="font-bold text-rq-lime">{formatPace(paces.paces[z])}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="glass p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{t.name}</div>
                  <div className="text-xs text-white/50 mt-0.5">{t.description}</div>
                  <div className="text-[11px] text-white/40 mt-1.5 tabular-nums">
                    ~{formatDistance(t.estDistanceM)} km · {formatDuration(t.estDurationSec)} · foco {ZONE_LABEL[t.focusZone].toLowerCase()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => launch(t, 'gps')} disabled={!!launching}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold bg-rq-lime/15 text-rq-lime border border-rq-lime/30 hover:bg-rq-lime/25 transition disabled:opacity-50">
                  <MapPin className="w-3.5 h-3.5" /> Correr GPS
                </button>
                <button onClick={() => launch(t, 'player')} disabled={!!launching}
                  className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-sm font-bold bg-white/5 border border-white/10 hover:border-white/20 transition disabled:opacity-50">
                  <Play className="w-3.5 h-3.5" /> Player
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-white/30">
          Paces via Riegel + zonas de treino. Cada treino cria uma cópia editável em “Meus treinos”.
        </p>
      </section>
    </main>
  );
}
