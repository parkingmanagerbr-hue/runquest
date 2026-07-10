'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDuration, formatDistance } from '@/lib/geo';

const KINDS = [
  { v: 'WARMUP', l: 'Aquecimento' },
  { v: 'INTERVAL_FAST', l: 'Tiro forte' },
  { v: 'INTERVAL_SLOW', l: 'Recuperação' },
  { v: 'TEMPO', l: 'Tempo' },
  { v: 'EASY', l: 'Leve' },
  { v: 'COOLDOWN', l: 'Volta calma' },
  { v: 'REST', l: 'Descanso' },
];
const TYPES = ['INTERVALS', 'TEMPO', 'LONG_RUN', 'EASY', 'RECOVERY', 'RACE', 'CUSTOM'];

// Cores por tipo — usadas na timeline visual e nas linhas.
const KIND_BAR: Record<string, string> = {
  WARMUP: 'bg-yellow-500/70',
  INTERVAL_FAST: 'bg-rq-orange',
  INTERVAL_SLOW: 'bg-blue-500/70',
  TEMPO: 'bg-purple-500/70',
  EASY: 'bg-rq-emerald/70',
  COOLDOWN: 'bg-cyan-500/70',
  REST: 'bg-white/30',
};

interface Seg {
  id: string;
  order: number;
  kind: string;
  mode: 'time' | 'distance';
  durationSec: number;
  distanceM: number;
  repeats: number;
}

let seq = 0;
const mk = (patch: Partial<Seg>): Seg => ({
  id: `${Date.now()}-${seq++}`, order: 0, kind: 'EASY', mode: 'time', durationSec: 60, distanceM: 400, repeats: 1, ...patch,
});

function defaultPace(): number {
  try {
    const s = JSON.parse(localStorage.getItem('rq.settings') ?? '{}');
    if (typeof s.defaultPaceSecPerKm === 'number' && s.defaultPaceSecPerKm > 0) return s.defaultPaceSecPerKm;
  } catch {}
  return 330; // 5:30/km
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('INTERVALS');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [segments, setSegments] = useState<Seg[]>([]);

  useEffect(() => {
    if (!tokens.hasSession()) router.replace('/auth/login');
  }, [router]);

  const pace = useMemo(() => defaultPace(), []);

  const addSeg = (patch: Partial<Seg> = {}) => setSegments((s) => [...s, mk(patch)]);
  const removeSeg = (id: string) => setSegments((s) => s.filter((x) => x.id !== id));
  const updateSeg = (id: string, patch: Partial<Seg>) =>
    setSegments((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (id: string, dir: -1 | 1) =>
    setSegments((s) => {
      const i = s.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  // Presets rápidos
  const addWarmup = () => addSeg({ kind: 'WARMUP', mode: 'time', durationSec: 600 });
  const addCooldown = () => addSeg({ kind: 'COOLDOWN', mode: 'time', durationSec: 300 });
  const addTempo = () => addSeg({ kind: 'TEMPO', mode: 'time', durationSec: 1200 });
  const addIntervalBlock = () =>
    setSegments((s) => {
      const block: Seg[] = [];
      for (let r = 0; r < 6; r++) {
        block.push(mk({ kind: 'INTERVAL_FAST', mode: 'distance', distanceM: 400 }));
        block.push(mk({ kind: 'INTERVAL_SLOW', mode: 'time', durationSec: 90 }));
      }
      return [...s, ...block];
    });

  // Totais (tempo real + distância estimada)
  const segDurSec = (s: Seg) => (s.mode === 'time' ? s.durationSec : Math.round((s.distanceM / 1000) * pace)) * s.repeats;
  const segDistM = (s: Seg) => (s.mode === 'distance' ? s.distanceM : Math.round((s.durationSec / pace) * 1000)) * s.repeats;
  const totalSec = segments.reduce((a, s) => a + segDurSec(s), 0);
  const totalM = segments.reduce((a, s) => a + segDistM(s), 0);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
        body: JSON.stringify({
          name, type, description: description || undefined,
          segments: segments.map((s, i) => ({
            order: i, kind: s.kind, repeats: s.repeats,
            ...(s.mode === 'time' ? { durationSec: s.durationSec } : { distanceM: s.distanceM }),
          })),
        }),
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      router.replace('/app/workouts');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app/workouts" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Novo treino</h1>
          <div className="ml-auto text-sm text-white/60 tabular-nums">{formatDuration(totalSec)} · ~{formatDistance(totalM)} km</div>
          <button onClick={save} disabled={saving || !name || segments.length === 0}
            className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex: Tiros 6×400m)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-lg font-bold focus:border-rq-lime/50 outline-none" />
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:border-rq-lime/50 outline-none">
            {TYPES.map((t) => <option key={t} value={t} className="bg-rq-night">{t}</option>)}
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={2}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:border-rq-lime/50 outline-none" />
        </div>

        {/* Timeline visual */}
        {segments.length > 0 && (
          <div>
            <div className="flex h-8 rounded-lg overflow-hidden border border-white/10">
              {segments.map((s) => (
                <div key={s.id} className={`${KIND_BAR[s.kind] ?? 'bg-white/30'} border-r border-black/20 last:border-0`}
                  style={{ width: `${totalSec > 0 ? (segDurSec(s) / totalSec) * 100 : 0}%` }}
                  title={`${KINDS.find((k) => k.v === s.kind)?.l} · ${formatDuration(segDurSec(s))}`} />
              ))}
            </div>
            <div className="text-[10px] text-white/30 mt-1">Proporcional ao tempo de cada bloco</div>
          </div>
        )}

        {/* Presets rápidos */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-white/40 self-center flex items-center gap-1"><Zap className="w-3 h-3 text-rq-lime" /> Presets:</span>
          <button onClick={addWarmup} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/25">+ Aquecimento</button>
          <button onClick={addIntervalBlock} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rq-orange/15 text-rq-orange border border-rq-orange/30 hover:bg-rq-orange/25">+ 6×(400m + 90s)</button>
          <button onClick={addTempo} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25">+ Tempo 20min</button>
          <button onClick={addCooldown} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25">+ Volta calma</button>
        </div>

        <div>
          <h2 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-3">Segmentos</h2>
          <div className="space-y-2">
            {segments.map((s, i) => (
              <div key={s.id} className="glass p-3 flex items-center gap-2 flex-wrap">
                <span className={`w-1.5 h-8 rounded-full ${KIND_BAR[s.kind] ?? 'bg-white/30'}`} />
                <div className="flex flex-col">
                  <button onClick={() => move(s.id, -1)} disabled={i === 0} className="text-white/40 hover:text-white disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(s.id, 1)} disabled={i === segments.length - 1} className="text-white/40 hover:text-white disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <select value={s.kind} onChange={(e) => updateSeg(s.id, { kind: e.target.value })}
                  className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm flex-1 min-w-[130px]">
                  {KINDS.map((k) => <option key={k.v} value={k.v} className="bg-rq-night">{k.l}</option>)}
                </select>
                <button onClick={() => updateSeg(s.id, { mode: s.mode === 'time' ? 'distance' : 'time' })}
                  className="text-xs text-rq-lime hover:underline" title="Alternar tempo/distância">
                  {s.mode === 'time' ? '⏱ tempo' : '📏 dist'}
                </button>
                {s.mode === 'time' ? (
                  <div className="flex items-center gap-1 text-sm">
                    <input type="number" min={1} value={s.durationSec}
                      onChange={(e) => updateSeg(s.id, { durationSec: Math.max(1, Number(e.target.value)) })}
                      className="w-20 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center tabular-nums" />
                    <span className="text-white/40">seg</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm">
                    <input type="number" min={1} value={s.distanceM}
                      onChange={(e) => updateSeg(s.id, { distanceM: Math.max(1, Number(e.target.value)) })}
                      className="w-20 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center tabular-nums" />
                    <span className="text-white/40">m</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm">
                  <input type="number" min={1} value={s.repeats}
                    onChange={(e) => updateSeg(s.id, { repeats: Math.max(1, Number(e.target.value)) })}
                    className="w-14 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center tabular-nums" />
                  <span className="text-white/40">×</span>
                </div>
                <button onClick={() => removeSeg(s.id)} className="text-white/40 hover:text-rq-orange ml-auto"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          {segments.length === 0 && (
            <div className="glass p-8 text-center text-white/40 text-sm">Adicione segmentos ou use um preset acima.</div>
          )}
          <button onClick={() => addSeg()} className="btn-ghost mt-3 w-full">
            <Plus className="w-4 h-4" /> Adicionar segmento
          </button>
        </div>
      </section>
    </main>
  );
}
