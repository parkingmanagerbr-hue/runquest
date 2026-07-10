'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, BellOff, Heart, MessageSquare, Trophy, Flag } from 'lucide-react';
import { tokens } from '@/lib/api';
import { usePushNotifications } from '@/lib/usePushNotifications';

interface Notif {
  id: string;
  type: string;
  title: string;
  data?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

const iconFor = (type: string) => {
  if (type === 'kudo') return <Heart className="w-5 h-5 text-rq-orange" />;
  if (type === 'comment') return <MessageSquare className="w-5 h-5 text-rq-lime" />;
  if (type === 'badge') return <Trophy className="w-5 h-5 text-yellow-400" />;
  if (type === 'mission') return <Flag className="w-5 h-5 text-blue-400" />;
  return <Bell className="w-5 h-5 text-white/60" />;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const push = usePushNotifications();

  const load = async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/notifications?limit=50`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    setItems(await r.json());
  };

  const markRead = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/notifications/mark-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    load();
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    // Ao abrir a tela: carrega e marca tudo como lido (ação única de montagem).
    // load/markRead são recriados a cada render — incluí-los reexecutaria em loop.
    load().then(markRead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Notificações</h1>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-2">
        {/* Push subscribe banner */}
        {push.supported && !push.subscribed && (
          <div className="glass p-4 flex items-center gap-3 border-rq-lime/30 bg-rq-lime/5">
            <Bell className="w-5 h-5 text-rq-lime shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Ativar notificações push</p>
              <p className="text-white/50 text-xs">Receba alertas de kudos, comentários e badges</p>
            </div>
            <button onClick={push.subscribe} disabled={push.loading}
              className="btn-primary text-xs py-1.5 px-3 shrink-0 disabled:opacity-50">
              {push.loading ? '…' : 'Ativar'}
            </button>
          </div>
        )}
        {push.supported && push.subscribed && (
          <div className="flex items-center gap-2 text-xs text-white/40 px-1">
            <Bell className="w-3.5 h-3.5 text-rq-lime" />
            <span>Notificações push ativas</span>
            <button onClick={push.unsubscribe} className="ml-auto text-white/30 hover:text-white/60">
              <BellOff className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {items.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nada por aqui ainda.</p>
          </div>
        )}
        {items.map(n => (
          <div key={n.id} className={`glass p-4 flex items-start gap-3 ${!n.readAt ? 'border-l-2 border-rq-lime' : ''}`}>
            <div className="mt-0.5">{iconFor(n.type)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{n.title}</p>
              <p className="text-xs text-white/40 mt-1">{new Date(n.createdAt).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
