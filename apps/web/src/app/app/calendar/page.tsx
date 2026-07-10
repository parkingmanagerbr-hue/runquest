'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar as CalIcon, CheckCircle2, Sparkles } from 'lucide-react';
import { tokens } from '@/lib/api';

interface ScheduledWorkout {
  date: string;
  label: string;
  workoutId?: string;
  distanceM?: number;
  durationSec?: number;
  completed: boolean;
}
interface Plan {
  id: string; name: string; goal: string; weeks: number;
  startDate: string; active: boolean;
  scheduledWorkouts: ScheduledWorkout[];
}
interface Template { id: string; name: string; goal: string; weeks: number; totalWorkouts: number; }

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function CalendarPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTpl, setStartingTpl] = useState<string | null>(null);

  const load = async () => {
    const [active, tpls] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/plans/active`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/plans/templates`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      }).then(r => r.json()),
    ]);
    setPlan(active && active.id ? active : null);
    setTemplates(tpls);
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router]);

  const startTemplate = async (id: string) => {
    setStartingTpl(id);
    const today = new Date().toISOString().slice(0, 10);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/plans/templates/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      body: JSON.stringify({ startDate: today }),
    });
    await load();
    setStartingTpl(null);
  };

  const markDone = async (date: string) => {
    if (!plan) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/plans/${plan.id}/mark-done`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      body: JSON.stringify({ date }),
    });
    await load();
  };

  // Calendário visual: agrupar por semana
  const weeks: ScheduledWorkout[][] = [];
  if (plan) {
    const start = new Date(plan.startDate);
    for (let w = 0; w < plan.weeks; w++) {
      const ws: ScheduledWorkout[] = [];
      for (let d = 0; d < 7; d++) {
        const target = new Date(start);
        target.setDate(target.getDate() + w * 7 + d);
        const found = plan.scheduledWorkouts.find(sw => sw.date === target.toISOString().slice(0, 10));
        if (found) ws.push(found); else ws.push({ date: target.toISOString().slice(0, 10), label: '', completed: false });
      }
      weeks.push(ws);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Calendário & Planos</h1>
          <CalIcon className="w-4 h-4 text-rq-lime ml-auto" />
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {loading && <div className="text-white/60">Carregando…</div>}

        {!loading && plan && (
          <>
            <div className="glass p-6">
              <div className="text-rq-lime text-xs uppercase tracking-wider font-bold mb-1">Plano ativo</div>
              <h2 className="font-display text-2xl font-black mb-1">{plan.name}</h2>
              <p className="text-white/60 text-sm">{plan.goal}</p>
            </div>

            <div className="space-y-3">
              {weeks.map((week, wi) => (
                <div key={wi} className="glass p-4">
                  <div className="text-xs text-white/40 uppercase font-bold mb-2">Semana {wi + 1}</div>
                  <div className="grid grid-cols-7 gap-1">
                    {week.map((d, di) => {
                      const isToday = d.date === today;
                      const hasWorkout = !!d.label;
                      return (
                        <div key={di}
                          className={`p-2 rounded-lg text-xs min-h-[80px] flex flex-col ${
                            !hasWorkout ? 'bg-white/[0.02]' :
                            d.completed ? 'bg-rq-lime/20 border border-rq-lime/40' :
                            isToday ? 'bg-rq-violet/30 border border-rq-violet/60 ring-1 ring-rq-violet' :
                            'bg-white/5 border border-white/10'
                          }`}>
                          <div className="text-[10px] text-white/40 mb-1">{DAYS[di]} {new Date(d.date).getDate()}</div>
                          {hasWorkout && (
                            <>
                              <div className="text-[11px] leading-tight font-medium flex-1">{d.label}</div>
                              {d.completed ? (
                                <CheckCircle2 className="w-3 h-3 text-rq-lime mt-1" />
                              ) : isToday ? (
                                <button onClick={() => markDone(d.date)} className="text-[10px] text-rq-lime hover:underline mt-1 text-left">
                                  ✓ feito
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !plan && (
          <div>
            <h2 className="font-display text-2xl font-black mb-4">Escolha um plano</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="glass p-6 flex flex-col">
                  <Sparkles className="w-5 h-5 text-rq-lime mb-3" />
                  <h3 className="font-display text-lg font-bold mb-1">{t.name}</h3>
                  <p className="text-xs text-white/60 mb-3 flex-1">{t.goal}</p>
                  <div className="flex items-center gap-3 text-xs text-white/60 mb-4">
                    <span>{t.weeks} semanas</span>
                    <span>•</span>
                    <span>{t.totalWorkouts} treinos</span>
                  </div>
                  <button onClick={() => startTemplate(t.id)} disabled={startingTpl === t.id}
                    className="btn-primary w-full text-sm py-2 disabled:opacity-50">
                    {startingTpl === t.id ? 'Iniciando…' : 'Começar plano'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
