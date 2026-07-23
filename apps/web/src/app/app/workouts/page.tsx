'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Play, Trash2, Clock, Repeat, Zap, MapPin, Dumbbell } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { formatDuration } from '@/lib/geo';

interface Segment {
  id: string;
  order: number;
  kind: string;
  durationSec?: number;
  distanceM?: number;
  repeats: number;
}
interface Workout {
  id: string;
  name: string;
  type: string;
  description?: string;
  totalDurationSec: number;
  totalDistanceM: number;
  segments: Segment[];
  isTemplate: boolean;
}

const KIND_LABEL: Record<string, string> = {
  WARMUP: 'Aquecimento',
  INTERVAL_FAST: 'Tiro forte',
  INTERVAL_SLOW: 'Recuperação',
  TEMPO: 'Tempo',
  EASY: 'Leve',
  COOLDOWN: 'Volta calma',
  REST: 'Descanso',
  CUSTOM: 'Custom',
};
const KIND_COLOR: Record<string, string> = {
  WARMUP: 'bg-yellow-500/20 text-yellow-300',
  INTERVAL_FAST: 'bg-rq-orange/20 text-rq-orange',
  INTERVAL_SLOW: 'bg-blue-500/20 text-blue-300',
  TEMPO: 'bg-purple-500/20 text-purple-300',
  EASY: 'bg-rq-emerald/20 text-rq-emerald',
  COOLDOWN: 'bg-cyan-500/20 text-cyan-300',
  REST: 'bg-white/20 text-white/70',
  CUSTOM: 'bg-rq-lime/20 text-rq-lime',
};

export default function WorkoutsPage() {
  const router = useRouter();
  const { confirm } = useToast();
  const [items, setItems] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.get<Workout[]>('/workouts')
      .then(setItems)
      .finally(() => setLoading(false));
  }, [router]);

  const remove = async (id: string) => {
    if (!(await confirm('Excluir esse treino?', 'Excluir'))) return;
    await api.del(`/workouts/${id}`);
    setItems(items.filter(i => i.id !== id));
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Treinos</h1>
          <Link href="/app/workouts/templates" className="ml-auto btn-ghost text-sm py-2 px-3">
            <Dumbbell className="w-4 h-4" /> Modelos
          </Link>
          <Link href="/app/workouts/new" className="btn-primary text-sm py-2 px-4">
            <Plus className="w-4 h-4" /> Novo treino
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <SkeletonList rows={4} />
        ) : items.length === 0 ? (
          <div className="glass p-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
            <h2 className="font-display text-xl font-bold mb-2">Nenhum treino ainda</h2>
            <p className="text-white/60 mb-6">Crie seu primeiro treino intervalado: tiros, tempo, longão…</p>
            <Link href="/app/workouts/new" className="btn-primary inline-flex">
              <Plus className="w-4 h-4" /> Criar treino
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(w => (
              <div key={w.id} className="glass p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs uppercase tracking-wider text-rq-lime font-bold">{w.type}</span>
                  {w.isTemplate && <span className="text-xs text-rq-gold">⭐ Modelo</span>}
                </div>
                <h3 className="font-display text-lg font-bold mb-1">{w.name}</h3>
                {w.description && <p className="text-xs text-white/60 mb-3">{w.description}</p>}

                <div className="flex items-center gap-4 text-xs text-white/60 mb-4">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(w.totalDurationSec)}</span>
                  <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{w.segments.length} segmentos</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {w.segments.slice(0, 8).map(s => (
                    <span key={s.id} className={`text-[10px] px-2 py-0.5 rounded ${KIND_COLOR[s.kind] ?? KIND_COLOR.CUSTOM}`}>
                      {s.repeats > 1 ? `${s.repeats}×` : ''}{KIND_LABEL[s.kind]}
                    </span>
                  ))}
                  {w.segments.length > 8 && <span className="text-[10px] text-white/40">+{w.segments.length - 8}</span>}
                </div>

                <div className="flex gap-2 mt-auto">
                  <Link href={`/app/workouts/${w.id}/play`} className="btn-primary flex-1 text-sm py-2">
                    <Play className="w-3.5 h-3.5" /> Iniciar
                  </Link>
                  <Link href={`/app/run?workout=${w.id}`} title="Correr com GPS + voz"
                    className="btn-ghost text-sm py-2 px-3 flex items-center gap-1.5 text-cyan-300 border-cyan-400/30">
                    <MapPin className="w-3.5 h-3.5" /> GPS
                  </Link>
                  {!w.isTemplate && (
                    <button onClick={() => remove(w.id)} className="btn-ghost text-sm py-2 px-3">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
