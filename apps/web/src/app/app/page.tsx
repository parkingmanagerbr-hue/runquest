'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens } from '@/lib/api';
import { LogoMark } from '@/components/LogoMark';
import Link from 'next/link';
import { Trophy, MapPinned, Sparkles, HeartPulse, LogOut, Link2, CheckCircle2, Play, Zap, History, Calendar as CalIcon, Target, Rss, Bell, Settings as Cog, Watch, Brain, TrendingUp, TrendingDown, BarChart2, Layers, Swords, X, ChevronRight, Smartphone, Timer, ShoppingBag, Users, type LucideIcon } from 'lucide-react';
import { formatPace } from '@/lib/geo';
import { localDateKey } from '@/lib/dateKey';
import { useToast } from '@/components/Toast';
import { Skeleton, SkeletonCards } from '@/components/Skeleton';

// Grid do dashboard, agora organizado por intenção em vez de um "muro" plano de
// 21 cards de mesmo peso. As 5 áreas mais usadas (Início, Missões, Correr,
// Ranking, Perfil) saíram daqui porque viraram a BottomNav — o resto fica
// agrupado e escaneável. Data-driven p/ não repetir 21 blocos JSX quase iguais.
interface Tile { href: string; label: string; sub: string; icon: LucideIcon; grad: string; }
interface Section { title: string; tiles: Tile[]; }

const SECTIONS: Section[] = [
  {
    title: 'Treino',
    tiles: [
      { href: '/app/workouts', label: 'Treinos', sub: 'Intervalados', icon: Zap, grad: 'from-rq-violet to-purple-500' },
      { href: '/app/calendar', label: 'Calendário', sub: 'Planos 5K/10K/21K', icon: CalIcon, grad: 'from-rq-violet to-blue-500' },
      { href: '/app/routes', label: 'Percursos', sub: 'Desenhe sua rota', icon: MapPinned, grad: 'from-rq-emerald to-cyan-500' },
      { href: '/app/devices', label: 'Relógio', sub: 'Amazfit · Garmin', icon: Watch, grad: 'from-rq-violet to-blue-600' },
    ],
  },
  {
    title: 'IA & Análise',
    tiles: [
      { href: '/app/ai-trainer', label: 'Trainer IA', sub: 'Plano adaptativo', icon: Brain, grad: 'from-rq-lime to-rq-violet' },
      { href: '/app/adaptive-plan', label: 'Plano Adaptativo', sub: 'Paces + carga', icon: TrendingUp, grad: 'from-rq-lime to-cyan-500' },
      { href: '/app/race-predictor', label: 'Previsor', sub: 'Previsão de prova', icon: Timer, grad: 'from-rq-lime/70 to-emerald-600' },
      { href: '/app/fitness', label: 'Evolução', sub: 'Está ficando + rápido?', icon: BarChart2, grad: 'from-cyan-400 to-rq-violet' },
      { href: '/app/stats', label: 'Estatísticas', sub: 'Progresso anual', icon: BarChart2, grad: 'from-rq-lime/70 to-rq-violet' },
      { href: '/app/zones', label: 'Zonas', sub: 'Z1-Z5 pace', icon: Layers, grad: 'from-rq-violet to-purple-800' },
    ],
  },
  {
    title: 'Jogo',
    tiles: [
      { href: '/app/challenges', label: 'Desafios', sub: 'Eventos da comunidade', icon: Swords, grad: 'from-rq-orange to-rq-gold' },
      { href: '/app/territories', label: 'Territórios', sub: 'Conquiste o mapa', icon: MapPinned, grad: 'from-rq-emerald to-cyan-500' },
      { href: '/app/shop', label: 'Loja', sub: 'Cosméticos', icon: ShoppingBag, grad: 'from-purple-500 to-pink-500' },
      { href: '/app/goals', label: 'Metas', sub: 'Semanais/mensais', icon: Target, grad: 'from-green-400 to-rq-lime' },
    ],
  },
  {
    title: 'Social',
    tiles: [
      { href: '/app/feed', label: 'Feed', sub: 'Atividades + kudos', icon: Rss, grad: 'from-pink-400 to-rq-orange' },
      { href: '/app/friends', label: 'Amigos', sub: 'Social', icon: Users, grad: 'from-cyan-400 to-blue-500' },
      { href: '/app/notifications', label: 'Notificações', sub: 'Atualizações', icon: Bell, grad: 'from-blue-400 to-rq-violet' },
    ],
  },
];

const ONBOARDING_KEY = 'rq.onboarded.v2';

const ONBOARDING_STEPS = [
  {
    icon: '🏃',
    title: 'Bem-vindo ao RunQuest!',
    text: 'Seu app de corrida com gamificação. Ganhe XP, conquiste territórios e evolua a cada km rodado.',
    cta: 'Vamos lá →',
  },
  {
    icon: '📍',
    title: 'Inicie sua primeira corrida',
    text: 'Use o GPS do seu celular para registrar qualquer corrida. Ou importe seus treinos do Strava automaticamente.',
    cta: 'Continuar →',
    action: null,
  },
  {
    icon: '🏆',
    title: 'Missões, badges e territórios',
    text: 'Complete missões diárias, conquiste territórios no mapa, desbloqueie badges e suba no ranking semanal.',
    cta: 'Começar agora',
  },
];

function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = ONBOARDING_STEPS[step];

  const next = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onDone();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass w-full max-w-sm p-8 text-center relative animate-fadeIn">
        <button onClick={onDone} className="absolute top-4 right-4 text-white/40 hover:text-white/70">
          <X className="w-4 h-4" />
        </button>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'bg-rq-lime w-6' : 'bg-white/20 w-1.5'}`} />
          ))}
        </div>

        <div className="text-6xl mb-5">{s.icon}</div>
        <h2 className="font-display text-2xl font-black mb-3">{s.title}</h2>
        <p className="text-white/60 text-sm leading-relaxed mb-8">{s.text}</p>

        {step === 1 && (
          <div className="flex gap-2 mb-4">
            <Link href="/app/run" onClick={onDone}
              className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 text-sm">
              <Smartphone className="w-4 h-4" /> GPS
            </Link>
            <Link href="/app/devices" onClick={onDone}
              className="flex-1 btn-ghost py-2.5 flex items-center justify-center gap-2 text-sm">
              <Link2 className="w-4 h-4" /> Strava
            </Link>
          </div>
        )}

        <button onClick={next}
          className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            step === ONBOARDING_STEPS.length - 1
              ? 'bg-gradient-to-r from-rq-lime to-rq-emerald text-rq-ink hover:opacity-90'
              : 'btn-ghost'
          }`}>
          {s.cta}
          {step < ONBOARDING_STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

interface WeekStats {
  runs: number;
  totalKm: number;
  totalSec: number;
  avgPaceSecPerKm: number;
  byDay: { day: number; km: number; runs: number }[];
  prevWeekKm: number;
  trend: number | null;
}

interface TodayWorkout {
  label: string;
  distanceM?: number;
  durationSec?: number;
  workoutId?: string;
  planName: string;
}
interface RecentRun {
  id: string;
  startedAt: string;
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
}
interface HomeMission {
  id: string; title: string; description: string; type: string;
  progress: number; target: number; claimed: boolean; completed: boolean;
  xpReward: number; coinReward: number;
}
interface HomeGoal {
  id: string; kind: string; period: string;
  target: number; progress: number; completed: boolean;
}

const DAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export default function AppDashboard() {
  const router = useRouter();
  const { toast, confirm } = useToast();
  const [me, setMe] = useState<{ displayName: string; email: string; isPremium: boolean; isOwner?: boolean; xp?: number; level?: number; runCoins?: number; streakDays?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [strava, setStrava] = useState<{ connected: boolean; athleteId?: string | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const [week, setWeek] = useState<WeekStats | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [missions, setMissions] = useState<HomeMission[]>([]);
  const [goals, setGoals] = useState<HomeGoal[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.me().then(setMe).catch(() => router.replace('/auth/login')).finally(() => setLoading(false));
    api.stravaStatus().then(setStrava).catch(() => {});
    // Via cliente api: ganha o auto-refresh de 401. O erro cai no mesmo .catch()
    // que antes tratava o `!r.ok` — comportamento preservado (não seta estado).
    // Manda o offset de fuso p/ a semana ser calculada no horário LOCAL do usuário.
    api.get<WeekStats | null>(`/runs/stats/week?tzOffsetMin=${new Date().getTimezoneOffset()}`)
      .then(d => d && setWeek(d)).catch(() => {});
    // Manda o dia LOCAL: o servidor (UTC) mostraria o treino de amanhã perto da
    // meia-noite p/ quem está a oeste de Greenwich.
    api.get<TodayWorkout | null>(`/plans/today?date=${localDateKey(new Date())}`)
      .then(d => d && setTodayWorkout(d)).catch(() => {});
    api.get<RecentRun[]>('/runs?limit=3')
      .then(d => Array.isArray(d) && setRecentRuns(d)).catch(() => {});
    api.get<HomeMission[]>('/missions')
      .then(d => Array.isArray(d) && setMissions(d.filter(m => !m.claimed).slice(0, 3))).catch(() => {});
    api.get<HomeGoal[]>('/goals')
      .then(d => Array.isArray(d) && setGoals(d.slice(0, 3))).catch(() => {});
    // Onboarding: show for new users that haven't seen it
    if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
    // Lê ?strava=connected da URL pós-callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava')) {
      const v = params.get('strava');
      setTimeout(() => api.stravaStatus().then(setStrava).catch(() => {}), 500);
      window.history.replaceState({}, '', '/app');
      if (v === 'error') toast('Erro ao conectar Strava: ' + params.get('reason'), 'error');
    }
  }, [router, toast]);

  const goPremium = async (plan: 'MONTHLY' | 'YEARLY') => {
    try {
      const { initPoint } = await api.checkout(plan);
      window.location.href = initPoint;
    } catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); }
  };

  const connectStrava = async () => {
    try {
      const { url } = await api.stravaAuthorizeUrl();
      window.location.href = url;
    } catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); }
  };

  const importStrava = async () => {
    setImporting(true);
    try {
      const r = await api.stravaImport(90);
      toast(`Importadas: ${r.imported} · Já existiam: ${r.skipped}`, 'success');
    } catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); }
    finally { setImporting(false); }
  };

  const disconnectStrava = async () => {
    if (!(await confirm('Desconectar Strava?', 'Desconectar'))) return;
    try { await api.stravaDisconnect(); setStrava({ connected: false }); }
    catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); }
  };

  const logout = () => { tokens.clear(); router.push('/'); };

  if (loading) return (
    <main className="min-h-screen bg-rq-aurora">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56 !bg-white/[0.07]" />
        <Skeleton className="h-20 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
        <SkeletonCards count={4} />
      </div>
    </main>
  );
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
            <span className="text-white/70 hidden sm:inline">{me.displayName}</span>
            {me.isPremium && (
              <span className="bg-gradient-to-br from-rq-lime/30 to-rq-violet/30 border border-rq-lime/40 text-rq-lime px-2.5 py-0.5 rounded-full text-xs font-bold">
                PREMIUM
              </span>
            )}
            <Link href="/app/settings" aria-label="Configurações" className="text-white/60 hover:text-white"><Cog className="w-4 h-4" /></Link>
            <button onClick={logout} aria-label="Sair" className="text-white/60 hover:text-white"><LogOut className="w-4 h-4" /></button>
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

        {/* Today's workout from active plan */}
        {todayWorkout && (
          <Link href={todayWorkout.workoutId ? `/app/workouts/${todayWorkout.workoutId}` : '/app/calendar'}
            className="glass mt-4 p-4 flex items-center gap-4 border-rq-violet/30 bg-gradient-to-br from-rq-violet/10 to-transparent hover:border-rq-violet/50 transition">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rq-violet to-blue-600 flex items-center justify-center shrink-0">
              <CalIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-rq-violet font-bold uppercase tracking-wider mb-0.5">{todayWorkout.planName} · Hoje</div>
              <div className="font-bold truncate">{todayWorkout.label}</div>
              <div className="text-xs text-white/50 mt-0.5">
                {todayWorkout.distanceM ? `${(todayWorkout.distanceM / 1000).toFixed(1)} km` : ''}
                {todayWorkout.distanceM && todayWorkout.durationSec ? ' · ' : ''}
                {todayWorkout.durationSec ? `${Math.round(todayWorkout.durationSec / 60)} min` : ''}
              </div>
            </div>
            <Play className="w-4 h-4 text-rq-violet shrink-0" />
          </Link>
        )}

        {/* Weekly stats bar */}
        {week && (
          <div className="glass mt-5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">Esta semana</h2>
              {week.trend !== null && (
                <span className={`text-xs flex items-center gap-1 ${week.trend >= 0 ? 'text-rq-lime' : 'text-rq-orange'}`}>
                  {week.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {week.trend >= 0 ? '+' : ''}{week.trend.toFixed(0)}% vs semana passada
                </span>
              )}
            </div>
            <div className="flex items-end gap-3 mb-3">
              <div>
                <span className="font-display text-3xl font-black">{week.totalKm.toFixed(1)}</span>
                <span className="text-white/40 text-sm ml-1">km</span>
              </div>
              <div className="text-white/40 text-sm pb-1">·</div>
              <div className="text-white/60 text-sm pb-1">{week.runs} corrida{week.runs !== 1 ? 's' : ''}</div>
              {week.avgPaceSecPerKm > 0 && (
                <>
                  <div className="text-white/40 text-sm pb-1">·</div>
                  <div className="text-white/60 text-sm pb-1">{formatPace(week.avgPaceSecPerKm)}/km</div>
                </>
              )}
            </div>
            {/* Day bars */}
            <div className="flex gap-1 items-end h-10">
              {week.byDay.map((d, i) => {
                const maxKm = Math.max(...week.byDay.map(x => x.km), 1);
                const h = d.km > 0 ? Math.max((d.km / maxKm) * 100, 15) : 0;
                const isToday = i === ((new Date().getDay() + 6) % 7);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-sm transition-all"
                      style={{
                        height: `${h}%`,
                        minHeight: d.km > 0 ? '4px' : '0',
                        background: d.km > 0
                          ? isToday ? 'var(--rq-lime, #c8ff00)' : 'rgba(200,255,0,0.4)'
                          : 'rgba(255,255,255,0.05)',
                      }} />
                    <span className={`text-[10px] ${isToday ? 'text-rq-lime font-bold' : 'text-white/30'}`}>
                      {DAY_LABELS[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {SECTIONS.map((section) => (
          <div key={section.title} className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">{section.title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {section.tiles.map((t) => {
                const Icon = t.icon;
                return (
                  <Link key={t.href} href={t.href} className="glass p-4 hover:border-rq-lime/40 transition group">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${t.grad} flex items-center justify-center mb-2 group-hover:scale-110 transition`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-sm">{t.label}</h3>
                    <p className="text-xs text-white/50">{t.sub}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

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

        {/* Recent runs */}
        {recentRuns.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">Últimas corridas</h2>
              <Link href="/app/history" className="text-xs text-rq-lime hover:underline">Ver todas →</Link>
            </div>
            <div className="space-y-2">
              {recentRuns.map(r => {
                const d = new Date(r.startedAt);
                return (
                  <Link key={r.id} href={`/app/runs/${r.id}`}
                    className="glass p-3 flex items-center gap-3 hover:border-rq-lime/30 transition">
                    <div className="text-center w-10 shrink-0">
                      <div className="text-xs text-white/40 uppercase leading-none">{d.toLocaleString('pt-BR', { month: 'short' })}</div>
                      <div className="font-display text-xl font-black leading-tight">{d.getDate()}</div>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                      <div><span className="font-bold text-rq-lime">{(r.distanceMeters / 1000).toFixed(2)}</span><span className="text-white/40 text-xs"> km</span></div>
                      <div className="tabular-nums text-white/70">{Math.floor(r.durationSec / 60)}:{String(r.durationSec % 60).padStart(2, '0')}</div>
                      <div className="tabular-nums text-white/50 text-xs">{Math.floor(r.avgPaceSecPerKm / 60)}:{String(r.avgPaceSecPerKm % 60).padStart(2, '0')}/km</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Active missions preview */}
        {missions.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-rq-gold" /> Missões ativas
              </h2>
              <Link href="/app/missions" className="text-xs text-rq-lime hover:underline">Ver todas →</Link>
            </div>
            <div className="space-y-2">
              {missions.map(m => {
                const pct = Math.min(100, (m.progress / m.target) * 100);
                const done = m.progress >= m.target;
                return (
                  <div key={m.id} className={`glass p-3 ${done ? 'border-rq-gold/40 bg-rq-gold/5' : ''}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold">{m.title}</span>
                      <span className="text-xs text-white/40 tabular-nums">{m.progress}/{m.target}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: done ? 'var(--rq-gold, #f5c842)' : 'linear-gradient(to right, #a3e635, #34d399)' }} />
                    </div>
                    {done && (
                      <div className="mt-1.5 text-xs text-rq-gold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Pronto para resgatar! → <Link href="/app/missions" className="underline">Resgatar</Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active goals preview */}
        {goals.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-rq-lime" /> Metas
              </h2>
              <Link href="/app/goals" className="text-xs text-rq-lime hover:underline">Gerenciar →</Link>
            </div>
            <div className="space-y-2">
              {goals.map(g => {
                const pct = Math.min(100, (g.progress / g.target) * 100);
                const kindLabel: Record<string, string> = { distance_km: 'km', runs_count: 'corridas', duration_min: 'min' };
                const periodLabel: Record<string, string> = { WEEKLY: 'Sem', MONTHLY: 'Mês', YEARLY: 'Ano' };
                return (
                  <div key={g.id} className={`glass p-3 ${g.completed ? 'border-rq-lime/40' : ''}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold tabular-nums">
                        {g.target} {kindLabel[g.kind] ?? g.kind}
                        <span className="text-white/40 text-xs font-normal ml-1">{periodLabel[g.period] ?? g.period}</span>
                      </span>
                      <span className="text-xs text-white/40 tabular-nums">
                        {g.kind === 'distance_km' ? g.progress.toFixed(1) : Math.floor(g.progress)}/{g.target}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: g.completed ? 'var(--rq-lime, #a3e635)' : 'linear-gradient(to right, #a3e635, #34d399)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

      {showOnboarding && <OnboardingModal onDone={dismissOnboarding} />}
    </main>
  );
}
