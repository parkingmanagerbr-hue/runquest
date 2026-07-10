'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Zap, Target, Calendar, ChevronRight, Lock } from 'lucide-react';
import { tokens } from '@/lib/api';

const GOALS = [
  { id: '5K', label: '5 km', emoji: '🏃', desc: 'Completar ou melhorar seu 5K' },
  { id: '10K', label: '10 km', emoji: '🏅', desc: 'Correr 10K com conforto' },
  { id: '21K', label: 'Meia maratona', emoji: '🥈', desc: '21.1 km em 12 semanas' },
  { id: '42K', label: 'Maratona', emoji: '🏆', desc: '42.2 km em 16 semanas' },
  { id: 'perda_de_peso', label: 'Perda de peso', emoji: '🔥', desc: 'Queimar gordura + condicionamento' },
  { id: 'condicionamento_geral', label: 'Condicionamento', emoji: '💪', desc: 'Melhorar capacidade aeróbica' },
];

const LEVELS = [
  { id: 'iniciante', label: 'Iniciante', desc: '< 10 km/semana' },
  { id: 'intermediario', label: 'Intermediário', desc: '10–40 km/semana' },
  { id: 'avancado', label: 'Avançado', desc: '> 40 km/semana' },
];

interface AiPlan { name: string; goal: string; weeks: number; scheduledWorkouts?: unknown[] }

export default function AITrainerPage() {
  const router = useRouter();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [goal, setGoal] = useState('5K');
  const [level, setLevel] = useState('iniciante');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiPlan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/users/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    }).then(r => r.json()).then(u => setIsPremium(u.isPremium || u.isOwner));
  }, [router]);

  const generate = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/plans/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
        body: JSON.stringify({ goal, level, daysPerWeek, startDate, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Erro ao gerar plano');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  };

  if (isPremium === null) return <main className="min-h-screen flex items-center justify-center text-white/60">Carregando…</main>;

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rq-lime" />
            <h1 className="font-display font-bold">Personal Trainer IA</h1>
          </div>
          <Link href="/app/coach" className="ml-auto flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 hover:border-rq-lime/40 px-3 py-1.5 rounded-full font-bold transition">
            <Sparkles className="w-3.5 h-3.5 text-rq-lime" /> Chat com Coach
          </Link>
          {isPremium && (
            <span className="text-xs bg-rq-lime/20 text-rq-lime border border-rq-lime/30 px-2 py-0.5 rounded-full font-bold">
              PREMIUM
            </span>
          )}
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {!isPremium && (
          <div className="glass p-6 border-rq-violet/40 bg-gradient-to-br from-rq-violet/10 to-transparent text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 text-rq-violet" />
            <h2 className="font-bold text-lg mb-1">Recurso Premium</h2>
            <p className="text-white/60 text-sm mb-4">Planos adaptativos gerados por IA são exclusivos para assinantes.</p>
            <Link href="/pricing" className="btn-primary inline-flex text-sm py-2 px-6">
              Ver planos · a partir de R$ 19,90/mês
            </Link>
          </div>
        )}

        {isPremium && (
          <>
            {/* Goal selection */}
            <div className="glass p-5">
              <h2 className="font-bold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-rq-lime" /> Objetivo</h2>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button key={g.id} onClick={() => setGoal(g.id)}
                    className={`p-3 rounded-xl text-left transition ${goal === g.id ? 'bg-rq-lime/20 border border-rq-lime/50' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}>
                    <div className="text-lg mb-0.5">{g.emoji}</div>
                    <div className="font-bold text-sm">{g.label}</div>
                    <div className="text-xs text-white/50">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Level */}
            <div className="glass p-5">
              <h2 className="font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-rq-violet" /> Nível</h2>
              <div className="flex gap-2">
                {LEVELS.map(l => (
                  <button key={l.id} onClick={() => setLevel(l.id)}
                    className={`flex-1 p-3 rounded-xl text-center transition ${level === l.id ? 'bg-rq-violet/20 border border-rq-violet/50' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}>
                    <div className="font-bold text-sm">{l.label}</div>
                    <div className="text-xs text-white/50">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Days + Start */}
            <div className="glass p-5 space-y-3">
              <h2 className="font-bold mb-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-rq-orange" /> Frequência e início</h2>
              <label className="block">
                <span className="text-xs text-white/60 uppercase tracking-wider">Dias por semana: {daysPerWeek}</span>
                <input type="range" min={2} max={6} value={daysPerWeek}
                  onChange={e => setDaysPerWeek(Number(e.target.value))}
                  className="w-full mt-2 accent-rq-lime" />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>2 dias</span><span>6 dias</span>
                </div>
              </label>
              <label className="block">
                <span className="text-xs text-white/60 uppercase tracking-wider">Data de início</span>
                <input type="date" value={startDate} min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5" />
              </label>
            </div>

            {/* Notes */}
            <div className="glass p-5">
              <label className="block">
                <span className="text-xs text-white/60 uppercase tracking-wider">Observações (opcional)</span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Ex: tenho dor no joelho, prefiro treinar de manhã, participo de prova dia XX/XX..."
                  className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 resize-none text-sm" />
              </label>
            </div>

            {error && <div className="glass p-3 border-rq-orange/40 text-rq-orange text-sm">{error}</div>}

            <button onClick={generate} disabled={loading}
              className="btn-primary w-full py-4 text-base disabled:opacity-50 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              {loading ? 'Gerando plano com IA…' : 'Gerar meu plano personalizado'}
            </button>

            {loading && (
              <div className="glass p-6 text-center animate-pulse">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-rq-lime" />
                <p className="text-white/60 text-sm">Analisando suas corridas e criando plano adaptado…</p>
              </div>
            )}

            {result && (
              <div className="glass p-5 border-rq-lime/30 bg-rq-lime/5">
                <div className="flex items-start gap-3 mb-4">
                  <Sparkles className="w-5 h-5 text-rq-lime mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-rq-lime">{result.name}</h3>
                    <p className="text-sm text-white/60 mt-0.5">{result.goal}</p>
                    <p className="text-xs text-white/40 mt-1">
                      {result.weeks} semanas · {result.scheduledWorkouts?.length ?? 0} treinos programados
                    </p>
                  </div>
                </div>
                <Link href="/app/calendar" className="btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4" /> Ver no calendário <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
