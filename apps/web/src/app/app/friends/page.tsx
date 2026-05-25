'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, UserPlus, UserCheck, Users } from 'lucide-react';
import { tokens } from '@/lib/api';

interface User { id: string; displayName: string; level: number; xp: number; selectedAvatar?: string; }

export default function FriendsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'following' | 'followers' | 'search'>('following');
  const [following, setFollowing] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` } };
    const [a, b] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/social/following`, h).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/social/followers`, h).then(r => r.json()),
    ]);
    setFollowing(a); setFollowers(b);
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (tab !== 'search' || q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/social/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      });
      setResults(await r.json());
    }, 250);
    return () => clearTimeout(t);
  }, [q, tab]);

  const follow = async (id: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/social/follow/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    await load();
  };
  const unfollow = async (id: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/social/unfollow/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    await load();
  };

  const followingIds = new Set(following.map(u => u.id));
  const display = tab === 'following' ? following : tab === 'followers' ? followers : results;

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Amigos</h1>
          <Users className="w-4 h-4 text-rq-lime ml-auto" />
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex bg-white/5 rounded-2xl p-1 mb-4">
          {(['following', 'followers', 'search'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm rounded-xl ${tab === t ? 'bg-rq-lime text-rq-ink font-bold' : 'text-white/60 hover:text-white'}`}>
              {t === 'following' ? `Seguindo (${following.length})` :
               t === 'followers' ? `Seguidores (${followers.length})` :
               'Buscar'}
            </button>
          ))}
        </div>

        {tab === 'search' && (
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Nome ou email…"
              className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 focus:border-rq-lime/50 outline-none"
            />
          </div>
        )}

        {loading ? <div className="text-white/60">Carregando…</div> : display.length === 0 ? (
          <div className="glass p-8 text-center text-white/50 text-sm">
            {tab === 'following' && 'Você ainda não segue ninguém. Vá em Buscar pra encontrar amigos.'}
            {tab === 'followers' && 'Ninguém te segue ainda.'}
            {tab === 'search' && (q.length < 2 ? 'Digite ao menos 2 caracteres' : 'Nenhum resultado')}
          </div>
        ) : (
          <div className="space-y-2">
            {display.map(u => {
              const isFollowing = followingIds.has(u.id);
              return (
                <div key={u.id} className="glass p-4 flex items-center gap-4">
                  <div className="text-3xl">{u.selectedAvatar ?? '🏃'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{u.displayName}</div>
                    <div className="text-xs text-white/40">Nível {u.level} · {u.xp} XP</div>
                  </div>
                  {tab !== 'followers' && (isFollowing ? (
                    <button onClick={() => unfollow(u.id)} className="btn-ghost text-xs py-1.5 px-3">
                      <UserCheck className="w-3.5 h-3.5" /> Seguindo
                    </button>
                  ) : (
                    <button onClick={() => follow(u.id)} className="btn-primary text-xs py-1.5 px-3">
                      <UserPlus className="w-3.5 h-3.5" /> Seguir
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
