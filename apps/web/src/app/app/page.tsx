'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens } from '@/lib/api';
import { LogoMark } from '@/components/LogoMark';
import { Trophy, MapPinned, Sparkles, HeartPulse, LogOut, Link2, CheckCircle2 } from 'lucide-react';

export default function AppDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<{ displayName: string; email: string; isPremium: boolean } | null>(null);
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
        <p className="text-white/60">Sua jornada começa aqui. Em breve: GPS tracking, missões, territórios.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[
            { icon: Trophy, label: 'Nível', value: '1' },
            { icon: Sparkles, label: 'XP', value: '0' },
            { icon: MapPinned, label: 'Territórios', value: '0' },
            { icon: HeartPulse, label: 'Streak', value: '0d' },
          ].map((s) => (
            <div key={s.label} className="glass p-5">
              <s.icon className="w-5 h-5 text-rq-lime mb-3" />
              <div className="text-2xl font-display font-black">{s.value}</div>
              <div className="text-xs text-white/50">{s.label}</div>
            </div>
          ))}
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

        {!me.isPremium && (
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
