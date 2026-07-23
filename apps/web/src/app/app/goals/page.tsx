'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Target, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface Goal {
  id: string; kind: string; period: string;
  target: number; progress: number;
  windowEnd: string; completed: boolean;
}

const KIND_LABEL: Record<string, string> = {
  distance_km: 'km',
  runs_count: 'corridas',
  duration_min: 'minutos',
};
const PERIOD_LABEL: Record<string, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
};

export default function GoalsPage() {
  const router = useRouter();
  const { confirm } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ kind: 'distance_km', period: 'WEEKLY', target: 20 });

  const load = async () => {
    setGoals(await api.get<Goal[]>('/goals'));
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router]);

  const create = async () => {
    await api.post('/goals', form);
    setCreating(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!(await confirm('Excluir meta?', 'Excluir'))) return;
    await api.del(`/goals/${id}`);
    await load();
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Metas</h1>
          <button onClick={() => setCreating(!creating)} className="ml-auto btn-primary text-sm py-2 px-3">
            <Plus className="w-4 h-4" /> Nova
          </button>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {creating && (
          <div className="glass p-5 space-y-3">
            <h2 className="font-bold">Nova meta</h2>
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5">
              <option value="distance_km" className="bg-rq-night">Distância (km)</option>
              <option value="runs_count" className="bg-rq-night">Número de corridas</option>
              <option value="duration_min" className="bg-rq-night">Duração (min)</option>
            </select>
            <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5">
              <option value="WEEKLY" className="bg-rq-night">Semanal (seg a dom)</option>
              <option value="MONTHLY" className="bg-rq-night">Mensal</option>
              <option value="YEARLY" className="bg-rq-night">Anual</option>
            </select>
            <div className="flex items-center gap-2">
              <input type="number" min={0.1} step={0.5} value={form.target}
                onChange={e => setForm({ ...form, target: Number(e.target.value) })}
                className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 tabular-nums" />
              <span className="text-white/60">{KIND_LABEL[form.kind]}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={create} className="btn-primary flex-1">Criar</button>
              <button onClick={() => setCreating(false)} className="btn-ghost">Cancelar</button>
            </div>
          </div>
        )}

        {loading ? <div className="text-white/60">Carregando…</div> :
         goals.length === 0 && !creating ? (
          <div className="glass p-12 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
            <h2 className="font-display text-xl font-bold mb-2">Sem metas</h2>
            <p className="text-white/60 mb-6">Defina uma meta semanal/mensal pra se manter constante.</p>
            <button onClick={() => setCreating(true)} className="btn-primary inline-flex">
              <Plus className="w-4 h-4" /> Criar primeira meta
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map(g => {
              const pct = Math.min(100, (g.progress / g.target) * 100);
              const remaining = Math.max(0, g.target - g.progress);
              return (
                <div key={g.id} className={`glass p-5 ${g.completed ? 'border-rq-lime/50' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-xs uppercase font-bold text-rq-violet">{PERIOD_LABEL[g.period]}</div>
                      <h3 className="font-display text-lg font-bold">
                        {g.target} {KIND_LABEL[g.kind]}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {g.completed && <CheckCircle2 className="w-5 h-5 text-rq-lime" />}
                      <button onClick={() => remove(g.id)} className="text-white/40 hover:text-rq-orange">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-white/60 mb-1 tabular-nums">
                    {g.kind === 'distance_km' ? g.progress.toFixed(1) : Math.floor(g.progress)} /{' '}
                    {g.target} {KIND_LABEL[g.kind]}
                    {!g.completed && remaining > 0 && (
                      <span className="text-rq-lime ml-2">faltam {g.kind === 'distance_km' ? remaining.toFixed(1) : Math.ceil(remaining)}</span>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${g.completed ? 'from-rq-lime to-rq-emerald' : 'from-rq-violet to-rq-lime'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
