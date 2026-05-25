'use client';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, SkipForward, X } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDuration } from '@/lib/geo';

interface Segment {
  id: string; order: number; kind: string;
  durationSec?: number; distanceM?: number; repeats: number; notes?: string;
}
interface Workout { id: string; name: string; segments: Segment[]; totalDurationSec: number; }

const KIND_LABEL: Record<string, string> = {
  WARMUP: 'Aquecimento', INTERVAL_FAST: 'TIRO FORTE', INTERVAL_SLOW: 'Recuperação',
  TEMPO: 'Tempo', EASY: 'Leve', COOLDOWN: 'Volta calma', REST: 'Descanso', CUSTOM: 'Custom',
};
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

// Expande segmentos com repeats em uma lista linear de passos
function expand(segs: Segment[]): { kind: string; durationSec: number; label: string }[] {
  const out: { kind: string; durationSec: number; label: string }[] = [];
  for (const s of segs) {
    for (let r = 0; r < s.repeats; r++) {
      out.push({
        kind: s.kind,
        durationSec: s.durationSec ?? 60,
        label: s.repeats > 1 ? `${KIND_LABEL[s.kind]} ${r + 1}/${s.repeats}` : KIND_LABEL[s.kind],
      });
    }
  }
  return out;
}

// Web Audio beep
function beep(freq = 880, durMs = 200, vol = 0.4) {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    const ctx = new Ctx();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    gain.gain.value = vol;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, durMs);
  } catch {}
}

// TTS leve via Web Speech API
function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

export default function WorkoutPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [steps, setSteps] = useState<{ kind: string; durationSec: number; label: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/workouts/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    })
      .then(r => r.json()).then((w: Workout) => {
        setWorkout(w);
        const list = expand(w.segments);
        setSteps(list);
        setRemaining(list[0]?.durationSec ?? 0);
      });
  }, [id, router]);

  // tick
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          // próximo segmento
          beep(1320, 250);
          setTimeout(() => {
            setIdx(i => {
              const next = i + 1;
              if (next >= steps.length) { setRunning(false); setDone(true); speak('Treino finalizado, parabéns!'); return i; }
              const nextStep = steps[next];
              speak(nextStep.label);
              setRemaining(nextStep.durationSec);
              return next;
            });
          }, 50);
          return 0;
        }
        if (r === 4) beep(660, 120, 0.25);
        if (r === 3) beep(660, 120, 0.25);
        if (r === 2) beep(660, 120, 0.25);
        return r - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running, steps]);

  const togglePlay = () => {
    if (!running && idx === 0 && remaining === steps[0]?.durationSec) {
      // primeiro play — fala o primeiro segmento
      speak(steps[0].label);
      beep(880, 200);
    }
    setRunning(r => !r);
  };
  const skip = () => {
    if (idx + 1 >= steps.length) return;
    setIdx(i => {
      const next = i + 1;
      setRemaining(steps[next].durationSec);
      speak(steps[next].label);
      return next;
    });
  };

  if (!workout) return <main className="min-h-screen flex items-center justify-center text-white/60">Carregando…</main>;

  const cur = steps[idx];
  const totalRemaining = steps.slice(idx).reduce((a, s, i) => a + (i === 0 ? remaining : s.durationSec), 0);
  const progress = cur ? 1 - remaining / cur.durationSec : 0;

  return (
    <main className={`min-h-screen bg-gradient-to-br ${cur ? KIND_BG[cur.kind] ?? KIND_BG.CUSTOM : 'from-rq-ink to-rq-night'} transition-colors duration-500`}>
      <header className="sticky top-0 z-30 backdrop-blur-md bg-black/30 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app/workouts" className="text-white/80"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">{workout.name}</h1>
          <div className="ml-auto text-xs text-white/70 tabular-nums">{idx + 1}/{steps.length} · {formatDuration(totalRemaining)} restantes</div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-12 flex flex-col items-center text-center">
        {done ? (
          <>
            <div className="text-7xl mb-4">🎉</div>
            <h2 className="font-display text-4xl font-black mb-2">Concluído!</h2>
            <p className="text-white/70 mb-8">Treino finalizado. Salve sua corrida ou volte aos treinos.</p>
            <div className="flex gap-3">
              <Link href="/app/run" className="btn-primary">Iniciar corrida</Link>
              <Link href="/app/workouts" className="btn-ghost">Voltar</Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm uppercase tracking-widest text-white/70 mb-3">{cur?.label}</div>
            <div className="font-display text-[180px] leading-none font-black tabular-nums mb-6">
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </div>

            <div className="w-full max-w-md h-2 rounded-full bg-white/15 overflow-hidden mb-12">
              <div className="h-full bg-white/90 transition-[width] duration-1000 ease-linear"
                   style={{ width: `${progress * 100}%` }} />
            </div>

            <div className="flex items-center gap-6">
              <Link href="/app/workouts" className="text-white/60 hover:text-white">
                <X className="w-8 h-8" />
              </Link>
              <button onClick={togglePlay}
                className="w-24 h-24 rounded-full bg-white text-rq-ink shadow-2xl flex items-center justify-center hover:scale-105 transition">
                {running ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
              </button>
              <button onClick={skip} disabled={idx >= steps.length - 1} className="text-white/60 hover:text-white disabled:opacity-30">
                <SkipForward className="w-8 h-8" />
              </button>
            </div>

            {/* Próximo */}
            {idx + 1 < steps.length && (
              <div className="mt-12 text-sm text-white/60">
                Próximo: <span className="font-bold text-white">{steps[idx + 1].label}</span> · {formatDuration(steps[idx + 1].durationSec)}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
