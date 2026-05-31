'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Heart, MessageCircle, Activity } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDistance, formatDuration, formatPace } from '@/lib/geo';

interface FeedRun {
  id: string;
  user: { id: string; displayName: string; selectedAvatar?: string; level: number };
  startedAt: string;
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  source: string;
  kudosCount: number;
  youKudoed: boolean;
  commentsCount: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<FeedRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/feed`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    setRuns(await r.json());
  };
  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router]);

  const kudo = async (id: string, youKudoed: boolean) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs/${id}/kudos`, {
      method: youKudoed ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    await load();
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Feed</h1>
          <Activity className="w-4 h-4 text-rq-lime ml-auto" />
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? <div className="text-white/60">Carregando…</div> :
         runs.length === 0 ? (
          <div className="glass p-12 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
            <h2 className="font-display text-xl font-bold mb-2">Feed vazio</h2>
            <p className="text-white/60 mb-4">
              Siga outros corredores em <Link href="/app/friends" className="text-rq-lime hover:underline">Amigos</Link> ou complete sua primeira corrida.
            </p>
            <Link href="/app/run" className="btn-primary inline-flex">Iniciar corrida</Link>
          </div>
        ) : (
          runs.map(r => {
            const d = new Date(r.startedAt);
            return (
              <article key={r.id} className="glass p-5">
                <Link href={`/app/runs/${r.id}`} className="flex items-center gap-3 mb-3">
                  <div className="text-3xl">{r.user.selectedAvatar ?? '🏃'}</div>
                  <div className="flex-1">
                    <div className="font-bold">{r.user.displayName}</div>
                    <div className="text-xs text-white/40">
                      Nível {r.user.level} · {d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {' '}{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {r.source !== 'GPS' && (
                    <span className="text-[10px] uppercase font-bold text-rq-orange">{r.source}</span>
                  )}
                </Link>

                <Link href={`/app/runs/${r.id}`} className="grid grid-cols-3 gap-3 mb-3 py-3 border-t border-b border-white/5">
                  <div>
                    <div className="font-display text-xl font-black">{formatDistance(r.distanceMeters)}</div>
                    <div className="text-xs text-white/40">km</div>
                  </div>
                  <div>
                    <div className="font-display text-xl font-black tabular-nums">{formatDuration(r.durationSec)}</div>
                    <div className="text-xs text-white/40">tempo</div>
                  </div>
                  <div>
                    <div className="font-display text-xl font-black tabular-nums">{formatPace(r.avgPaceSecPerKm)}</div>
                    <div className="text-xs text-white/40">pace</div>
                  </div>
                </Link>

                <div className="flex items-center gap-4 text-sm">
                  <button onClick={() => kudo(r.id, r.youKudoed)}
                    className={`flex items-center gap-1.5 transition ${r.youKudoed ? 'text-rq-orange' : 'text-white/60 hover:text-rq-orange'}`}>
                    <Heart className={`w-4 h-4 ${r.youKudoed ? 'fill-current' : ''}`} />
                    {r.kudosCount > 0 && <span className="tabular-nums">{r.kudosCount}</span>}
                  </button>
                  <Link href={`/app/runs/${r.id}`} className="flex items-center gap-1.5 text-white/60 hover:text-white">
                    <MessageCircle className="w-4 h-4" />
                    {r.commentsCount > 0 && <span className="tabular-nums">{r.commentsCount}</span>}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
