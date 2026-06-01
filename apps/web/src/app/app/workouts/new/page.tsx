'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDuration } from '@/lib/geo';

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

interface Seg {
  id: string;
  order: number;
  kind: string;
  mode: 'time' | 'distance';
  durationSec: number;
  distanceM: number;
  repeats: number;
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('INTERVALS');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [segments, setSegments] = useState<Seg[]>([]);

  const addSeg = () => setSegments([...segments, {
    id: String(Date.now()), order: segments.length, kind: 'EASY', mode: 'time', durationSec: 60, distanceM: 400, repeats: 1,
  }]);
  const removeSeg = (id: string) => setSegments(segments.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })));
  const updateSeg = (id: string, patch: Partial<Seg>) =>
    setSegments(segments.map(s => s.id === id ? { ...s, ...patch } : s));

  const totalSec = segments.reduce((a, s) => a + s.durationSec * s.repeats, 0);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
        body: JSON.stringify({
          name, type, description: description || undefined,
          segments: segments.map(s => ({
            order: s.order, kind: s.kind, repeats: s.repeats,
            ...(s.mode === 'time' ? { durationSec: s.durationSec } : { distanceM: s.distanceM }),
          })),
        }),
      });
      router.replace('/app/workouts');
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app/workouts" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Novo treino</h1>
          <div className="ml-auto text-sm text-white/60 tabular-nums">{formatDuration(totalSec)}</div>
          <button onClick={save} disabled={saving || !name} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="space-y-3">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Nome (ex: Tiros 6×400m)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-lg font-bold focus:border-rq-lime/50 outline-none"
          />
          <select
            value={type} onChange={e => setType(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:border-rq-lime/50 outline-none"
          >
            {TYPES.map(t => <option key={t} value={t} className="bg-rq-night">{t}</option>)}
          </select>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (opcional)" rows={2}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:border-rq-lime/50 outline-none"
          />
        </div>

        <div>
          <h2 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-3">Segmentos</h2>
          <div className="space-y-2">
            {segments.map((s, i) => (
              <div key={s.id} className="glass p-4 flex items-center gap-3 flex-wrap">
                <div className="text-white/40 font-mono w-6">{i + 1}</div>
                <select
                  value={s.kind} onChange={e => updateSeg(s.id, { kind: e.target.value })}
                  className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm flex-1 min-w-[140px]"
                >
                  {KINDS.map(k => <option key={k.v} value={k.v} className="bg-rq-night">{k.l}</option>)}
                </select>
                <button
                  onClick={() => updateSeg(s.id, { mode: s.mode === 'time' ? 'distance' : 'time' })}
                  className="text-xs text-rq-lime hover:underline"
                  title="Alternar tempo/distância"
                >
                  {s.mode === 'time' ? '⏱' : '📏'}
                </button>
                {s.mode === 'time' ? (
                  <div className="flex items-center gap-1 text-sm">
                    <input
                      type="number" min={1} value={s.durationSec}
                      onChange={e => updateSeg(s.id, { durationSec: Number(e.target.value) })}
                      className="w-20 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center tabular-nums"
                    />
                    <span className="text-white/40">seg</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm">
                    <input
                      type="number" min={1} value={s.distanceM}
                      onChange={e => updateSeg(s.id, { distanceM: Number(e.target.value) })}
                      className="w-20 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center tabular-nums"
                    />
                    <span className="text-white/40">m</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm">
                  <input
                    type="number" min={1} value={s.repeats}
                    onChange={e => updateSeg(s.id, { repeats: Number(e.target.value) })}
                    className="w-16 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center tabular-nums"
                  />
                  <span className="text-white/40">×</span>
                </div>
                <button onClick={() => removeSeg(s.id)} className="text-white/40 hover:text-rq-orange">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addSeg} className="btn-ghost mt-3 w-full">
            <Plus className="w-4 h-4" /> Adicionar segmento
          </button>
        </div>
      </section>
    </main>
  );
}
