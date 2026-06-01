'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens } from '@/lib/api';
import { LogoMark } from '@/components/LogoMark';
import Link from 'next/link';
import { Trophy, MapPinned, Sparkles, HeartPulse, LogOut, Link2, CheckCircle2, Play, Zap, History, Calendar as CalIcon, Target, Rss, Bell, Settings as Cog, Watch, Brain } from 'lucide-react';

export default function AppDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<{ displayName: string; email: string; isPremium: boolean; isOwner?: boolean; xp?: number; level?: number; runCoins?: number; streakDays?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [strava, setStrava] = useState<{ connected: boolean; athleteId?: string | null } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.me().then(setMe).catch(() => router.replace('/auth/login')).finally(() => setLoading(false));
    api.stravaStatus().then(setStrava).catch(() => {});
    // Lê ?strava=connected da URL pós-callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava')) {
      const v = params.get('strava');
      setTimeout(() => api.stravaStatus().then(setStrava).catch(() => {}), 500);
      window.history.replaceState({}, '', '/app');
      if (v === 'error') alert('Erro ao conectar Strava: ' + params.get('reason'));
    }
  }, [router]);

  const goPremium = async (plan: 'MONTHLY' | 'YEARLY') => {
    try {
      const { initPoint } = await api.checkout(plan);
      window.location.href = initPoint;
    } catch (e: any) { alert(e.message); }
  };

  const connectStrava = async () => {
    try {
      const { url } = await api.stravaAuthorizeUrl();
      window.location.href = url;
    } catch (e: any) { alert(e.message); }
  };

  const importStrava = async () => {
    setImporting(true);
    try {
      const r = await api.stravaImport(90);
      alert(`Importadas: ${r.imported} | Já existiam: ${r.skipped}`);
    } catch (e: any) { alert(e.message); }
    finally { setImporting(false); }
  };

  const disconnectStrava = async () => {
    if (!confirm('Desconectar Strava?')) return;
    try { await api.stravaDisconnect(); setStrava({ connected: false }); }
    catch (e: any) { alert(e.message); }
  };

  const logout = () => { tokens.clear(); router.push('/'); };

  if (loading) return <main className="min-h-screen flex items-center justify-center text-white/60">Carregando…</main>;
  if (!me) return null;

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/60 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="w-9 h-9" />
            <span className="font-display tracking-tight">RunQuest</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/70">{me.displayName}</span>
            {me.isPremium && (
              <span className="bg-gradient-to-br from-rq-lime/30 to-rq-violet/30 border border-rq-lime/40 text-rq-lime px-2.5 py-0.5 rounded-full text-xs font-bold">
                PREMIUM
              </span>
            )}
            <button onClick={logout} className="text-white/60 hover:text-white"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto p-6">
        <h1 className="font-display text-3xl font-black mb-2">Olá, {me.displayName.split(' ')[0]}.</h1>
        <p className="text-white/60">
          {me.streakDays && me.streakDays > 0
            ? `🔥 ${me.streakDays} dias seguidos — continue assim!`
            : 'Inicie sua primeira corrida e comece a conquistar territórios.'}
        </p>

        {/* Ação primária — destaque maior */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Link href="/app/run"
            className="glass p-5 hover:border-rq-lime/60 transition group border-rq-lime/30 bg-gradient-to-br from-rq-lime/10 to-transparent">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rq-lime to-rq-emerald flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Play className="w-5 h-5 text-rq-ink" />
            </div>
            <h3 className="font-bold">Iniciar corrida</h3>
            <p className="text-xs text-white/50 mt-0.5">GPS ao vivo · mapa em tempo real</p>
          </Link>
          <Link href="/app/history"
            className="glass p-5 hover:border-rq-orange/40 transition group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rq-orange to-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <History className="w-5 h-5 text-rq-ink" />
            </div>
            <h3 className="font-bold">Minhas corridas</h3>
            <p className="text-xs text-white/50 mt-0.5">Ver mapa + splits de cada corrida</p>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
          <Link href="/app/devices" className="glass p-4 hover:border-rq-violet/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-violet to-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Watch className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm">Relógio</h3>
            <p className="text-xs text-white/50">Amazfit · Garmin</p>
          </Link>
          <Link href="/app/workouts" className="glass p-4 hover:border-rq-violet/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-violet to-purple-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm">Treinos</h3>
            <p className="text-xs text-white/50">Intervalados</p>
          </Link>
          <Link href="/app/missions" className="glass p-4 hover:border-rq-gold/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-gold to-rq-orange flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Trophy className="w-4 h-4 text-rq-ink" />
            </div>
            <h3 className="font-bold text-sm">Missões</h3>
            <p className="text-xs text-white/50">Diárias/semanais</p>
          </Link>
          <Link href="/app/territories" className="glass p-4 hover:border-rq-emerald/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-emerald to-cyan-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <MapPinned className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm">Territórios</h3>
            <p className="text-xs text-white/50">Conquiste mapa</p>
          </Link>
          <Link href="/app/calendar" className="glass p-4 hover:border-rq-violet/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-violet to-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <CalIcon className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm">Calendário</h3>
            <p className="text-xs text-white/50">Planos 5K/10K/21K</p>
          </Link>
          <Link href="/app/leaderboard" className="glass p-4 hover:border-rq-gold/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-gold to-yellow-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Trophy className="w-4 h-4 text-rq-ink" />
            </div>
            <h3 className="font-bold text-sm">Ranking</h3>
            <p className="text-xs text-white/50">Semanal</p>
          </Link>
          <Link href="/app/shop" className="glass p-4 hover:border-rq-violet/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <span className="text-base">🛍️</span>
            </div>
            <h3 className="font-bold text-sm">Loja</h3>
            <p className="text-xs text-white/50">Cosméticos</p>
          </Link>
          <Link href="/app/friends" className="glass p-4 hover:border-cyan-400/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <span className="text-base">👥</span>
            </div>
            <h3 className="font-bold text-sm">Amigos</h3>
            <p className="text-xs text-white/50">Social</p>
          </Link>
          <Link href="/app/profile" className="glass p-4 hover:border-rq-lime/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-lime to-emerald-500 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <span className="text-base">👤</span>
            </div>
            <h3 className="font-bold text-sm">Perfil</h3>
            <p className="text-xs text-white/50">XP + badges</p>
          </Link>
          <Link href="/app/goals" className="glass p-4 hover:border-rq-lime/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-rq-lime flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Target className="w-4 h-4 text-rq-ink" />
            </div>
            <h3 className="font-bold text-sm">Metas</h3>
            <p className="text-xs text-white/50">Semanais/mensais</p>
          </Link>
          <Link href="/app/feed" className="glass p-4 hover:border-pink-400/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rq-orange flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Rss className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm">Feed</h3>
            <p className="text-xs text-white/50">Atividades + kudos</p>
          </Link>
          <Link href="/app/notifications" className="glass p-4 hover:border-blue-400/40 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-rq-violet flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm">Notificações</h3>
            <p className="text-xs text-white/50">Atualizações</p>
          </Link>
          <Link href="/app/settings" className="glass p-4 hover:border-white/30 transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Cog className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm">Config</h3>
            <p className="text-xs text-white/50">Perfil + coach</p>
          </Link>
          <Link href="/app/ai-trainer"
            className={`glass p-4 transition group ${me.isPremium || me.isOwner ? 'hover:border-rq-lime/50 border-rq-lime/20 bg-gradient-to-br from-rq-lime/5 to-transparent' : 'hover:border-rq-violet/40'}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rq-lime to-rq-violet flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Brain className="w-4 h-4 text-rq-ink" />
            </div>
            <h3 className="font-bold text-sm">Trainer IA</h3>
            <p className="text-xs text-white/50">{me.isPremium || me.isOwner ? 'Plano adaptativo' : '🔒 Premium'}</p>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="glass p-4">
            <Trophy className="w-4 h-4 text-rq-lime mb-2" />
            <div className="font-display text-2xl font-black">{me.level ?? 1}</div>
            <div className="text-xs text-white/50">Nível</div>
          </div>
          <div className="glass p-4">
            <Sparkles className="w-4 h-4 text-rq-violet mb-2" />
            <div className="font-display text-2xl font-black tabular-nums">{me.xp ?? 0}</div>
            <div className="text-xs text-white/50">XP</div>
          </div>
          <div className="glass p-4">
            <span className="w-4 h-4 text-rq-gold mb-2 block">🪙</span>
            <div className="font-display text-2xl font-black tabular-nums">{me.runCoins ?? 0}</div>
            <div className="text-xs text-white/50">RunCoins</div>
          </div>
          <div className="glass p-4">
            <HeartPulse className="w-4 h-4 text-rq-orange mb-2" />
            <div className="font-display text-2xl font-black">{me.streakDays ?? 0}d</div>
            <div className="text-xs text-white/50">Streak</div>
          </div>
        </div>

        <div className="glass mt-8 p-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="font-bold">Strava</h2>
            {strava?.connected ? (
              <p className="text-sm text-rq-lime flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Conectado · athlete {strava.athleteId}
              </p>
            ) : (
              <p className="text-sm text-white/60">Importe automaticamente suas corridas do Strava.</p>
            )}
          </div>
          {strava?.connected ? (
            <>
              <button onClick={importStrava} disabled={importing} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
                {importing ? 'Importando…' : 'Importar últimos 90 dias'}
              </button>
              <button onClick={disconnectStrava} className="btn-ghost text-sm py-2 px-4">Desconectar</button>
            </>
          ) : (
            <button onClick={connectStrava} className="btn-primary text-sm py-2 px-4">Conectar Strava</button>
          )}
        </div>

        {me.isOwner && (
          <div className="glass mt-6 p-5 border-rq-gold/30 bg-gradient-to-br from-rq-gold/10 to-rq-orange/5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <h3 className="font-bold text-rq-gold">Owner — Premium vitalício</h3>
                <p className="text-xs text-white/60">Sem cobrança. Acesso total a todas as features Premium.</p>
              </div>
            </div>
          </div>
        )}

        {!me.isPremium && !me.isOwner && (
          <div className="glass mt-8 p-8 border-rq-violet/30 bg-gradient-to-br from-rq-violet/10 to-rq-lime/5">
            <div className="flex items-start gap-4 flex-wrap">
              <HeartPulse className="w-10 h-10 text-rq-lime shrink-0" />
              <div className="flex-1 min-w-[260px]">
                <h2 className="font-display text-xl font-black mb-1">Personal Trainer IA</h2>
                <p className="text-white/60 text-sm">
                  Plano semanal adaptativo, coach por voz, análise pós-corrida. Cancele quando quiser.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => goPremium('MONTHLY')} className="btn-ghost text-sm py-2 px-4">R$ 19,90/mês</button>
                <button onClick={() => goPremium('YEARLY')} className="btn-primary text-sm py-2 px-4">R$ 149,90/ano</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
