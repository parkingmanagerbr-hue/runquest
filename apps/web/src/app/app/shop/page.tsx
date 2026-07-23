'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Coins, CheckCircle2, Lock, Crown } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { SkeletonPage } from '@/components/Skeleton';

interface Item {
  id: string; code: string; name: string; description: string | null;
  kind: 'avatar' | 'territory_color' | string;
  value: string; price: number; icon: string | null;
  rarity: string; owned: boolean; premiumOnly: boolean;
}
interface ShopData { coins: number; selected: { avatar?: string; territoryColor?: string }; items: Item[]; }

const RARITY_BG: Record<string, string> = {
  common: 'bg-white/5 border-white/10',
  rare: 'bg-blue-500/10 border-blue-500/30',
  epic: 'bg-purple-500/15 border-purple-500/40',
  legendary: 'bg-gradient-to-br from-rq-gold/20 to-rq-orange/15 border-rq-gold/50',
};

export default function ShopPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setData(await api.get<ShopData>('/shop'));
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load().finally(() => setLoading(false));
  }, [router]);

  const buy = async (id: string) => {
    setBusy(id);
    const r = await api.post<{ error?: string }>(`/shop/${id}/buy`);
    if (r.error) toast(r.error, 'error');
    else toast('Comprado! 🎉', 'success');
    await load();
    setBusy(null);
  };
  const equip = async (id: string) => {
    setBusy(id);
    await api.post(`/shop/${id}/equip`);
    await load();
    setBusy(null);
  };

  if (loading || !data) return <SkeletonPage />;

  const colors = data.items.filter(i => i.kind === 'territory_color');
  const avatars = data.items.filter(i => i.kind === 'avatar');

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Loja</h1>
          <Link href="/pricing" className="ml-auto flex items-center gap-1.5 text-xs bg-rq-gold/15 text-rq-gold border border-rq-gold/30 hover:bg-rq-gold/25 px-3 py-1.5 rounded-full font-bold transition">
            <Crown className="w-3.5 h-3.5" /> Premium
          </Link>
          <div className="flex items-center gap-1 text-rq-gold">
            <Coins className="w-4 h-4" />
            <span className="font-bold tabular-nums">{data.coins}</span>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Avatars */}
        <div>
          <h2 className="font-display text-xl font-bold mb-3">Avatars</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {avatars.map(i => {
              const selected = data.selected.avatar === i.value;
              return (
                <div key={i.id} className={`p-4 rounded-2xl border ${RARITY_BG[i.rarity]} text-center`}>
                  <div className="text-5xl mb-2">{i.icon ?? '?'}</div>
                  <div className="text-xs font-bold leading-tight mb-1">{i.name}</div>
                  {selected ? (
                    <div className="text-[10px] text-rq-lime flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Equipado</div>
                  ) : i.owned ? (
                    <button onClick={() => equip(i.id)} disabled={busy === i.id} className="text-[10px] text-rq-lime hover:underline">Equipar</button>
                  ) : i.premiumOnly ? (
                    <Link href="/pricing" className="text-[10px] text-rq-violet flex items-center justify-center gap-0.5 hover:underline"><Lock className="w-3 h-3" />Premium</Link>
                  ) : (
                    <button onClick={() => buy(i.id)} disabled={busy === i.id || data.coins < i.price}
                      className="text-[11px] flex items-center justify-center gap-0.5 text-rq-gold disabled:opacity-50 hover:underline">
                      <Coins className="w-3 h-3" /> {i.price}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cores de território */}
        <div>
          <h2 className="font-display text-xl font-bold mb-3">Cores de territórios</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {colors.map(i => {
              const selected = data.selected.territoryColor === i.value;
              const isRainbow = i.value === 'rainbow';
              return (
                <div key={i.id} className={`p-4 rounded-2xl border ${RARITY_BG[i.rarity]} text-center`}>
                  <div className="w-16 h-16 mx-auto rounded-full mb-2 border-2 border-white/20"
                    style={{
                      background: isRainbow ? 'conic-gradient(red, orange, yellow, green, cyan, blue, magenta, red)' : i.value,
                    }} />
                  <div className="text-xs font-bold leading-tight mb-1">{i.name}</div>
                  {selected ? (
                    <div className="text-[10px] text-rq-lime flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3" />Equipado</div>
                  ) : i.owned || i.price === 0 ? (
                    <button onClick={() => equip(i.id)} disabled={busy === i.id} className="text-[10px] text-rq-lime hover:underline">Equipar</button>
                  ) : (
                    <button onClick={() => buy(i.id)} disabled={busy === i.id || data.coins < i.price}
                      className="text-[11px] flex items-center justify-center gap-0.5 text-rq-gold disabled:opacity-50 hover:underline">
                      <Coins className="w-3 h-3" /> {i.price}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
