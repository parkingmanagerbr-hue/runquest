'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Target, Trophy, Coins, Sparkles, CheckCircle2 } from 'lucide-react';
import { tokens } from '@/lib/api';

interface Mission {
  id: string;
  code: string;
  title: string;
  description: string;
  scope: 'DAILY' | 'WEEKLY' | 'EVENT';
  goalKind: string;
  goalValue: number;
  xpReward: number;
  coinReward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  pct: number;
}

const SCOPE_LABEL: Record<string, string> = { DAILY: 'Diária', WEEKLY: 'Semanal', EVENT: 'Evento' };
const SCOPE_COLOR: Record<string, string> = {
  DAILY: 'from-rq-lime to-rq-emerald',
  WEEKLY: 'from-rq-violet to-purple-500',
  EVENT: 'from-rq-orange to-rq-gold',
};
const KIND_UNIT: Record<string, string> = {
  distance_km: 'km',
  runs_count: 'corridas',
  duration_min: 'min',
  territory_capture: 'territórios',
};

export default function MissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/missions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    setMissions(await r.json());
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router]);

  const claim = async (m: Mission) => {
    setClaiming(m.id);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/missions/${m.id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      }).then(r => r.json());
      if (r.ok) alert(`🎉 +${r.xp} XP · +${r.coins} 🪙 RunCoins`);
      else alert(r.error);
      await load();
    } finally { setClaiming(null); }
  };

  const daily = missions.filter(m => m.scope === 'DAILY');
  const weekly = missions.filter(m => m.scope === 'WEEKLY');

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Missões</h1>
          <Target className="w-4 h-4 text-rq-lime ml-auto" />
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {loading && <div className="text-white/60">Carregando…</div>}

        {!loading && (
          <>
            <div>
              <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
                <span className="text-rq-lime">●</span> Diárias
                <span className="text-xs text-white/40 font-normal">reset 00:00</span>
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {daily.map(m => <MissionCard key={m.id} m={m} onClaim={() => claim(m)} loading={claiming === m.id} />)}
              </div>
            </div>

            <div>
              <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
                <span className="text-rq-violet">●</span> Semanais
                <span className="text-xs text-white/40 font-normal">reset segunda 00:00</span>
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {weekly.map(m => <MissionCard key={m.id} m={m} onClaim={() => claim(m)} loading={claiming === m.id} />)}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function MissionCard({ m, onClaim, loading }: { m: Mission; onClaim: () => void; loading: boolean }) {
  const unit = KIND_UNIT[m.goalKind] ?? '';
  const showProgress = m.goalKind === 'distance_km' ? m.progress.toFixed(1) : Math.floor(m.progress);
  return (
    <div className={`glass p-5 ${m.claimed ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-rq-gold shrink-0 mt-0.5" />
        <h3 className="font-bold leading-tight">{m.title}</h3>
        {SCOPE_LABEL[m.scope] && (
          <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
            {SCOPE_LABEL[m.scope]}
          </span>
        )}
        {m.claimed && <CheckCircle2 className="w-4 h-4 text-rq-lime ml-auto shrink-0" />}
      </div>
      <p className="text-xs text-white/60 mb-3 min-h-[2lh]">{m.description}</p>

      <div className="text-xs text-white/50 mb-1 tabular-nums">
        {showProgress} / {m.goalValue} {unit}
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
        <div className={`h-full bg-gradient-to-r ${SCOPE_COLOR[m.scope]}`} style={{ width: `${m.pct}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-rq-lime"><Trophy className="w-3 h-3" />{m.xpReward}</span>
          <span className="flex items-center gap-1 text-rq-gold"><Coins className="w-3 h-3" />{m.coinReward}</span>
        </div>
        {m.completed && !m.claimed ? (
          <button onClick={onClaim} disabled={loading} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
            {loading ? '…' : 'Resgatar'}
          </button>
        ) : m.claimed ? (
          <span className="text-xs text-rq-lime">✓ resgatada</span>
        ) : (
          <span className="text-xs text-white/40">{m.pct}%</span>
        )}
      </div>
    </div>
  );
}
