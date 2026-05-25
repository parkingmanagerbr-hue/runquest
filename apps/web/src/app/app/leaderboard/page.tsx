'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy, TrendingUp, MapPinned, Sparkles } from 'lucide-react';
import { tokens } from '@/lib/api';

type Kind = 'xp' | 'distance' | 'territories';
interface Row { rank: number; userId: string; displayName: string; avatar?: string; level: number; value: number; isMe: boolean; }

const TABS: { k: Kind; label: string; icon: any; unit: string }[] = [
  { k: 'xp', label: 'XP', icon: Sparkles, unit: 'XP' },
  { k: 'distance', label: 'Distância', icon: TrendingUp, unit: 'km' },
  { k: 'territories', label: 'Territórios', icon: MapPinned, unit: 'cap.' },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('xp');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (k: Kind) => {
    setLoading(true);
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/leaderboard?kind=${k}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    setRows(await r.json());
    setLoading(false);
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load(kind);
  }, [router, kind]);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Ranking</h1>
          <span className="ml-auto text-xs text-white/40">essa semana</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setKind(t.k)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm flex items-center justify-center gap-2 transition ${
                kind === t.k ? 'bg-rq-lime text-rq-ink font-bold' : 'text-white/60 hover:text-white'
              }`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="text-white/60">Carregando…</div> : rows.length === 0 ? (
          <div className="glass p-12 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
            <h2 className="font-display text-xl font-bold">Sem ranking ainda</h2>
            <p className="text-white/60 mt-2">Corra essa semana pra aparecer aqui!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.userId} className={`glass p-4 flex items-center gap-4 ${r.isMe ? 'border-rq-lime/60 bg-rq-lime/10' : ''}`}>
                <div className={`w-10 text-center font-display text-2xl font-black ${r.rank === 1 ? 'text-rq-gold' : r.rank === 2 ? 'text-gray-300' : r.rank === 3 ? 'text-orange-400' : 'text-white/40'}`}>
                  {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                </div>
                <div className="text-3xl">{r.avatar ?? '🏃'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{r.displayName} {r.isMe && <span className="text-rq-lime text-xs">(você)</span>}</div>
                  <div className="text-xs text-white/40">Nível {r.level}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-black tabular-nums">{r.value}</div>
                  <div className="text-xs text-white/40">{TABS.find(t => t.k === kind)?.unit}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
