'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Award } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { SkeletonCards } from '@/components/Skeleton';

interface Badge { id: string; code: string; title: string; description: string; icon: string; tier: string; unlocked: boolean; unlockedAt?: string | null; xpReward: number; coinReward: number; }

const TIER_COLOR: Record<string, string> = {
  bronze: 'bg-orange-700/20 text-orange-300 border-orange-700/40',
  silver: 'bg-gray-400/15 text-gray-200 border-gray-400/30',
  gold: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  platinum: 'bg-cyan-400/20 text-cyan-200 border-cyan-400/50',
};

export default function BadgesPage() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.get<Badge[]>('/badges').then(setBadges)
      .catch(() => setBadges([])) // erro de API degrada p/ lista vazia (o fetch cru não lançava)
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app/profile" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Conquistas</h1>
          <Award className="w-4 h-4 text-rq-lime ml-auto" />
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        {loading ? <SkeletonCards count={8} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {badges.map(b => (
              <div key={b.id} className={`glass p-4 border ${b.unlocked ? TIER_COLOR[b.tier] : 'opacity-30 grayscale'}`}>
                <div className="text-4xl mb-2">{b.icon}</div>
                <h3 className="font-bold text-sm leading-tight mb-1">{b.title}</h3>
                <p className="text-xs text-white/60 min-h-[2lh]">{b.description}</p>
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-white/10">
                  <span className="uppercase font-bold tabular-nums">{b.tier}</span>
                  {b.unlocked ? <span className="text-rq-lime">✓ desbloqueado</span> : <span className="text-rq-lime">+{b.xpReward}xp +{b.coinReward}🪙</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
