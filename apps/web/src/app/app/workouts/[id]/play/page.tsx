'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, X } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { SkeletonPage } from '@/components/Skeleton';
import { formatDuration } from '@/lib/geo';
import { useWorkoutEngine, type RawSegment } from '@/lib/useWorkoutEngine';

interface Workout {
  id: string;
  name: string;
  segments: RawSegment[];
  totalDurationSec: number;
}

const KIND_BG: Record<string, string> = {
  WARMUP: 'from-yellow-500/40 to-amber-500/30',
  INTERVAL_FAST: 'from-rq-orange/60 to-red-500/40',
  INTERVAL_SLOW: 'from-blue-500/40 to-cyan-500/30',
  TEMPO: 'from-purple-500/40 to-violet-500/30',
  EASY: 'from-rq-emerald/40 to-green-500/30',
  COOLDOWN: 'from-cyan-500/40 to-teal-500/30',
  REST: 'from-white/20 to-white/5',
  CUSTOM: 'from-rq-lime/40 to-emerald-500/30',
};

export default function WorkoutPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    if (!tokens.hasSession()) {
      router.replace('/auth/login');
      return;
    }
    api.get<Workout>(`/workouts/${id}`)
      .then((w) => setWorkout(w));
  }, [id, router]);

  const eng = useWorkoutEngine(workout?.segments ?? null);

  if (!workout) {
    return <SkeletonPage />;
  }

  const { cur, next, idx, steps, remaining, running, done, totalRemaining, progress } = eng;
  const soon = running && remaining <= 3 && !!next; // pré-aviso visual do próximo bloco

  return (
    <main
      className={`min-h-screen bg-gradient-to-br ${
        cur ? KIND_BG[cur.kind] ?? KIND_BG.CUSTOM : 'from-rq-ink to-rq-night'
      } transition-colors duration-500`}
    >
      <header className="sticky top-0 z-30 backdrop-blur-md bg-black/30 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app/workouts" className="text-white/80">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold">{workout.name}</h1>
          <div className="ml-auto text-xs text-white/70 tabular-nums">
            {idx + 1}/{steps.length} · {formatDuration(totalRemaining)} restantes
          </div>
        </div>
      </header>

      {/* Barra de progresso global do treino */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-white/70 transition-[width] duration-500"
          style={{ width: `${steps.length ? ((idx + progress) / steps.length) * 100 : 0}%` }}
        />
      </div>

      <section className="max-w-3xl mx-auto px-6 py-12 flex flex-col items-center text-center">
        {done ? (
          <>
            <div className="text-7xl mb-4">🎉</div>
            <h2 className="font-display text-4xl font-black mb-2">Concluído!</h2>
            <p className="text-white/70 mb-8">Treino finalizado. Salve sua corrida ou volte aos treinos.</p>
            <div className="flex gap-3">
              <Link href="/app/run" className="btn-primary">
                Iniciar corrida
              </Link>
              <Link href="/app/workouts" className="btn-ghost">
                Voltar
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm uppercase tracking-widest text-white/70 mb-3 flex items-center gap-2">
              {cur?.label}
              {cur?.isLastRep && (
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">ÚLTIMA</span>
              )}
            </div>

            <div
              className={`font-display text-[180px] leading-none font-black tabular-nums mb-6 transition-transform ${
                soon ? 'scale-110' : ''
              }`}
            >
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </div>

            {cur?.distanceM && (
              <div className="-mt-4 mb-4 text-white/60 text-sm">alvo ~{cur.distanceM} m</div>
            )}

            <div className="w-full max-w-md h-2 rounded-full bg-white/15 overflow-hidden mb-12">
              <div
                className="h-full bg-white/90 transition-[width] duration-500 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-5">
              <button
                onClick={eng.prev}
                disabled={idx <= 0}
                className="text-white/60 hover:text-white disabled:opacity-30"
                aria-label="Anterior"
              >
                <SkipBack className="w-8 h-8" />
              </button>
              <button
                onClick={eng.toggle}
                className="w-24 h-24 rounded-full bg-white text-rq-ink shadow-2xl flex items-center justify-center hover:scale-105 transition"
                aria-label={running ? 'Pausar' : 'Iniciar'}
              >
                {running ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
              </button>
              <button
                onClick={eng.skip}
                disabled={idx >= steps.length - 1}
                className="text-white/60 hover:text-white disabled:opacity-30"
                aria-label="Próximo"
              >
                <SkipForward className="w-8 h-8" />
              </button>
            </div>

            {/* Próximo bloco — pré-aviso destacado nos últimos segundos */}
            {next && (
              <div
                className={`mt-12 text-sm transition-all ${
                  soon ? 'text-white font-bold scale-105' : 'text-white/60'
                }`}
              >
                {soon ? 'Prepare-se: ' : 'Próximo: '}
                <span className="font-bold text-white">{next.label}</span> ·{' '}
                {formatDuration(next.durationSec)}
              </div>
            )}

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
              <Link href="/app/workouts" className="text-white/40 hover:text-white/80 inline-flex items-center gap-1 text-xs">
                <X className="w-4 h-4" /> Encerrar
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
