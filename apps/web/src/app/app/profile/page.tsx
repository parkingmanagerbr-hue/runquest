'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy, Sparkles, Coins, Heart, Award, Calendar, Activity, Flame, Zap, Timer } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDistance, formatDuration, formatPace } from '@/lib/geo';

interface PR { label: string; best: { runId: string; paceSecPerKm: number; durationSec: number; distanceMeters: number; date: string } | null }

interface Me {
  id: string; email: string; displayName: string;
  isOwner?: boolean; isPremium?: boolean;
  xp: number; level: number; runCoins: number;
  streakDays: number; longestStreak: number;
  totalRuns: number; totalDistanceM: number;
  selectedAvatar?: string;
  selectedTerritoryColor?: string;
}
interface Badge { id: string; code: string; title: string; description: string; icon: string; tier: string; unlocked: boolean; }

function nextLevelXp(level: number) { return Math.round(100 * Math.pow(level, 1.5)); }

/** Riegel formula: T2 = T1 × (D2/D1)^1.06 */
function riegelPredict(refDistM: number, refDurSec: number, targetDistM: number): number {
  return refDurSec * Math.pow(targetDistM / refDistM, 1.06);
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function levelXpRange(level: number) {
  return { start: level === 1 ? 0 : nextLevelXp(level - 1), end: nextLevelXp(level) };
}

const TIER_COLOR: Record<string, string> = {
  bronze: 'bg-orange-700/30 text-orange-300 border-orange-700/50',
  silver: 'bg-gray-400/20 text-gray-200 border-gray-400/40',
  gold: 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50',
  platinum: 'bg-cyan-400/30 text-cyan-200 border-cyan-400/60',
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [daily, setDaily] = useState<{ claimed: boolean; streak: number } | null>(null);
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` } };
    const safeJson = (r: Response) => r.ok ? r.json().catch(() => null) : null;
    const [u, b, d, p] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/users/me`, h).then(safeJson),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/badges`, h).then(safeJson),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/daily/status`, h).then(safeJson),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs/stats/prs`, h).then(safeJson).catch(() => []),
    ]);
    if (u) setMe(u);
    setBadges(Array.isArray(b) ? b : []);
    if (d) setDaily(d);
    setPrs(Array.isArray(p) ? p : []);
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router]);

  const claimDaily = async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/daily/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    }).then(r => r.json());
    if (r.ok) alert(`+${r.coins} 🪙 RunCoins!`);
    else alert(r.error);
    await load();
  };

  if (loading || !me) return <main className="min-h-screen flex items-center justify-center text-white/60">Carregando…</main>;

  const range = levelXpRange(me.level);
  const xpInLevel = me.xp - range.start;
  const xpForNext = range.end - range.start;
  const pct = Math.min(100, (xpInLevel / xpForNext) * 100);

  const unlockedBadges = badges.filter(b => b.unlocked);
  const lockedBadges = badges.filter(b => !b.unlocked);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Perfil</h1>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Profile header */}
        <div className="glass p-6 flex items-center gap-5">
          <div className="text-7xl">{me.selectedAvatar ?? '🏃'}</div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-black flex items-center gap-2">
              {me.displayName}
              {me.isOwner && <span className="text-rq-gold">👑</span>}
              {me.isPremium && !me.isOwner && <span className="text-xs bg-gradient-to-br from-rq-lime/30 to-rq-violet/30 border border-rq-lime/40 text-rq-lime px-2.5 py-0.5 rounded-full font-bold">PREMIUM</span>}
            </h2>
            <div className="text-sm text-white/60">{me.email}</div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-rq-lime">Nível {me.level}</span>
                <span className="text-white/40 tabular-nums">{xpInLevel} / {xpForNext} XP</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rq-lime to-rq-emerald" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass p-4">
            <Activity className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-2xl font-black">{me.totalRuns}</div>
            <div className="text-xs text-white/50">corridas</div>
          </div>
          <div className="glass p-4">
            <Award className="w-4 h-4 text-rq-violet mb-1" />
            <div className="font-display text-2xl font-black">{(me.totalDistanceM / 1000).toFixed(1)}</div>
            <div className="text-xs text-white/50">km totais</div>
          </div>
          <div className="glass p-4">
            <Flame className="w-4 h-4 text-rq-orange mb-1" />
            <div className="font-display text-2xl font-black">{me.streakDays}d</div>
            <div className="text-xs text-white/50">streak · max {me.longestStreak}d</div>
          </div>
          <div className="glass p-4">
            <Coins className="w-4 h-4 text-rq-gold mb-1" />
            <div className="font-display text-2xl font-black tabular-nums">{me.runCoins}</div>
            <div className="text-xs text-white/50">RunCoins</div>
          </div>
        </div>

        {/* Personal Records */}
        {prs.some(p => p.best) && (
          <div className="glass p-5">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/60 flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-rq-lime" /> Recordes Pessoais
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {prs.map(pr => (
                <div key={pr.label} className={`rounded-xl p-3 ${pr.best ? 'bg-gradient-to-br from-rq-lime/10 to-transparent border border-rq-lime/20' : 'bg-white/5 border border-white/5 opacity-40'}`}>
                  <div className="text-xs text-white/50 mb-1">{pr.label}</div>
                  {pr.best ? (
                    <Link href={`/app/runs/${pr.best.runId}`} className="block hover:opacity-80">
                      <div className="font-display text-lg font-black text-rq-lime tabular-nums">
                        {formatPace(pr.best.paceSecPerKm)}<span className="text-xs font-normal text-white/40">/km</span>
                      </div>
                      <div className="text-xs text-white/50 tabular-nums">{formatDuration(pr.best.durationSec)}</div>
                      <div className="text-xs text-white/30 mt-0.5">{new Date(pr.best.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                    </Link>
                  ) : (
                    <div className="text-xs text-white/30">Sem corrida</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Race Predictor — Riegel formula */}
        {prs.some(p => p.best) && (() => {
          // Find best reference PR (shortest distance with a result = most accurate)
          const ref = prs.find(p => p.best) ?? null;
          if (!ref?.best) return null;
          const refDist = ref.best.distanceMeters;
          const refDur = ref.best.durationSec;
          const predictions = [
            { label: '5K', dist: 5000 },
            { label: '10K', dist: 10000 },
            { label: 'Meia', dist: 21097 },
            { label: 'Maratona', dist: 42195 },
          ].filter(p => Math.abs(p.dist - refDist) > p.dist * 0.2); // exclude the reference distance

          return (
            <div className="glass p-5">
              <h2 className="font-bold text-sm uppercase tracking-wider text-white/60 flex items-center gap-2 mb-1">
                <Timer className="w-4 h-4 text-rq-violet" /> Predição de Provas
              </h2>
              <p className="text-xs text-white/30 mb-4">Baseado no seu {ref.label} usando fórmula de Riegel</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {predictions.map(p => {
                  const predSec = riegelPredict(refDist, refDur, p.dist);
                  const predPace = Math.round(predSec / (p.dist / 1000));
                  return (
                    <div key={p.label} className="rounded-xl p-3 bg-gradient-to-br from-rq-violet/10 to-transparent border border-rq-violet/20">
                      <div className="text-xs text-white/50 mb-1">{p.label}</div>
                      <div className="font-display text-lg font-black text-rq-violet tabular-nums">{fmtTime(predSec)}</div>
                      <div className="text-xs text-white/40 tabular-nums">{Math.floor(predPace / 60)}:{String(predPace % 60).padStart(2, '0')}/km</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Daily login */}
        {daily && (
          <div className={`glass p-5 flex items-center gap-4 ${daily.claimed ? 'opacity-60' : 'border-rq-gold/40 bg-rq-gold/10'}`}>
            <Coins className="w-8 h-8 text-rq-gold" />
            <div className="flex-1">
              <h3 className="font-bold">Bônus diário</h3>
              <p className="text-xs text-white/60">
                {daily.claimed ? 'Já resgatado hoje. Volte amanhã!' : `50 RunCoins + ${Math.min(daily.streak * 5, 250)} bonus por streak`}
              </p>
            </div>
            {!daily.claimed && (
              <button onClick={claimDaily} className="btn-primary text-sm py-2 px-4">Resgatar</button>
            )}
          </div>
        )}

        {/* Badges */}
        <div>
          <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-rq-lime" /> Conquistas
            <span className="text-sm font-normal text-white/40">{unlockedBadges.length}/{badges.length}</span>
            <Link href="/app/badges" className="ml-auto text-xs text-rq-lime hover:underline">Ver todas →</Link>
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {unlockedBadges.slice(0, 16).map(b => (
              <div key={b.id} className={`glass p-3 text-center border ${TIER_COLOR[b.tier]}`} title={b.title}>
                <div className="text-2xl mb-1">{b.icon}</div>
                <div className="text-[10px] font-bold leading-tight">{b.title}</div>
              </div>
            ))}
            {unlockedBadges.length === 0 && (
              <div className="col-span-full text-sm text-white/50 italic">Complete sua primeira corrida pra desbloquear seu primeiro badge!</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
