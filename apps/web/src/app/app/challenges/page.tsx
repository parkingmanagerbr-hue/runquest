'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Swords, Trophy, Coins, Users, CheckCircle2, Flag, Crown } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

interface Challenge {
  id: string;
  code: string;
  title: string;
  description: string;
  goalKind: string;
  goalValue: number;
  xpReward: number;
  coinReward: number;
  startsAt: string;
  endsAt: string;
  status: 'upcoming' | 'active' | 'ended';
  participantCount: number;
  joined: boolean;
  progress: number;
  completed: boolean;
  claimed: boolean;
  pct: number;
}

interface LeaderRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  selectedAvatar: string | null;
  progress: number;
  completed: boolean;
  isMe: boolean;
}

const KIND_UNIT: Record<string, string> = {
  distance_km: 'km',
  runs_count: 'corridas',
  duration_min: 'min',
};
const STATUS_LABEL: Record<string, string> = { upcoming: 'Em breve', active: 'Ativo', ended: 'Encerrado' };

function daysLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'encerrado';
  const d = Math.ceil(ms / 86_400_000);
  return d === 1 ? 'termina hoje' : `faltam ${d} dias`;
}

export default function ChallengesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [board, setBoard] = useState<{ id: string; rows: LeaderRow[] } | null>(null);

  const load = useCallback(async () => {
    setChallenges(await api.get<Challenge[]>('/challenges'));
  }, []);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router, load]);

  const join = async (c: Challenge) => {
    setBusy(c.id);
    try {
      await api.post(`/challenges/${c.id}/join`);
      await load();
    } finally { setBusy(null); }
  };

  const claim = async (c: Challenge) => {
    setBusy(c.id);
    try {
      const r = await api.post<{ ok: boolean; xp?: number; coins?: number; error?: string }>(`/challenges/${c.id}/claim`);
      if (r.ok) toast(`🎉 +${r.xp} XP · +${r.coins} 🪙 RunCoins`, 'success');
      else toast(r.error ?? 'Não foi possível resgatar.', 'error');
      await load();
    } finally { setBusy(null); }
  };

  const openBoard = async (c: Challenge) => {
    const rows = await api.get<LeaderRow[]>(`/challenges/${c.id}/leaderboard`);
    setBoard({ id: c.id, rows });
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Desafios</h1>
          <Swords className="w-4 h-4 text-rq-orange ml-auto" />
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {loading && <SkeletonList rows={4} />}

        {!loading && challenges.length === 0 && (
          <div className="glass p-8 text-center text-white/60">
            <Flag className="w-8 h-8 mx-auto mb-3 text-white/30" />
            Nenhum desafio ativo no momento. Volte em breve! 🏃
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {challenges.map(c => (
            <ChallengeCard
              key={c.id}
              c={c}
              busy={busy === c.id}
              onJoin={() => join(c)}
              onClaim={() => claim(c)}
              onBoard={() => openBoard(c)}
            />
          ))}
        </div>
      </section>

      {board && (
        <LeaderboardModal rows={board.rows} onClose={() => setBoard(null)} />
      )}
    </main>
  );
}

function ChallengeCard({
  c, busy, onJoin, onClaim, onBoard,
}: { c: Challenge; busy: boolean; onJoin: () => void; onClaim: () => void; onBoard: () => void }) {
  const unit = KIND_UNIT[c.goalKind] ?? '';
  const showProgress = c.goalKind === 'distance_km' ? c.progress.toFixed(1) : Math.floor(c.progress);
  return (
    <div className={`glass p-5 ${c.claimed ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2 mb-2">
        <Swords className="w-4 h-4 text-rq-orange shrink-0 mt-0.5" />
        <h3 className="font-bold leading-tight">{c.title}</h3>
        {c.claimed && <CheckCircle2 className="w-4 h-4 text-rq-lime ml-auto shrink-0" />}
      </div>
      <p className="text-xs text-white/60 mb-3">{c.description}</p>

      <div className="flex items-center gap-3 text-xs text-white/40 mb-3">
        <span className={`px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-rq-lime/15 text-rq-lime' : 'bg-white/5'}`}>
          {STATUS_LABEL[c.status]}
        </span>
        <span>{daysLeft(c.endsAt)}</span>
        <button onClick={onBoard} className="ml-auto flex items-center gap-1 hover:text-white/70">
          <Users className="w-3 h-3" />{c.participantCount}
        </button>
      </div>

      {c.joined && (
        <>
          <div className="text-xs text-white/50 mb-1 tabular-nums">
            {showProgress} / {c.goalValue} {unit}
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-rq-orange to-rq-gold" style={{ width: `${c.pct}%` }} />
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-rq-lime"><Trophy className="w-3 h-3" />{c.xpReward}</span>
          <span className="flex items-center gap-1 text-rq-gold"><Coins className="w-3 h-3" />{c.coinReward}</span>
        </div>
        {!c.joined ? (
          <button onClick={onJoin} disabled={busy || c.status === 'ended'} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
            {busy ? '…' : 'Participar'}
          </button>
        ) : c.completed && !c.claimed ? (
          <button onClick={onClaim} disabled={busy} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
            {busy ? '…' : 'Resgatar'}
          </button>
        ) : c.claimed ? (
          <span className="text-xs text-rq-lime">✓ resgatado</span>
        ) : (
          <span className="text-xs text-white/40">{c.pct}%</span>
        )}
      </div>
    </div>
  );
}

function LeaderboardModal({ rows, onClose }: { rows: LeaderRow[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass w-full max-w-md max-h-[80vh] overflow-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-rq-gold" />
          <h2 className="font-display font-bold">Ranking</h2>
          <button onClick={onClose} className="ml-auto text-white/50 hover:text-white text-sm">Fechar</button>
        </div>
        {rows.length === 0 && <p className="text-sm text-white/50">Ninguém participou ainda.</p>}
        <ul className="space-y-1">
          {rows.map(r => (
            <li key={r.userId} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${r.isMe ? 'bg-rq-lime/10' : ''}`}>
              <span className={`w-6 text-center font-bold text-sm ${r.rank <= 3 ? 'text-rq-gold' : 'text-white/40'}`}>{r.rank}</span>
              <span className="text-sm flex-1 truncate">{r.displayName}{r.isMe && ' (você)'}</span>
              {r.completed && <CheckCircle2 className="w-3.5 h-3.5 text-rq-lime shrink-0" />}
              <span className="text-xs text-white/50 tabular-nums">{r.progress.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
