'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, Square, MapPin, Activity, ArrowLeft, Heart, Zap, Trophy, Flame, Star, Mountain, Navigation, Footprints } from 'lucide-react';
import Link from 'next/link';
import { api, tokens } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { haptic, SUCCESS } from '@/lib/haptics';
import { haversine, formatPace, formatDuration, formatDistance } from '@/lib/geo';
import { useHeartRate } from '@/lib/useHeartRate';
import { useCadence } from '@/lib/useCadence';
import { useAudioCoach } from '@/lib/useAudioCoach';
import { useWorkoutEngine, speak, type RawSegment } from '@/lib/useWorkoutEngine';
import { ghostProgress, leadChangeCallout, finishCallout } from '@/lib/ghostRace';
import { saveActiveRun, loadActiveRun, clearActiveRun, type ActiveRun } from '@/lib/runPersistence';
import { watchPosition as geoWatch, isNativePlatform, type GeoWatchHandle } from '@/lib/geolocation';
import { isAcceptableFix, acceptStep, elevationStep, splitPace, gpsSignal, elapsedSec } from '@/lib/gpsTrack';
import { StravaUpload } from '@/components/StravaUpload';
import { estimateCalories } from '@/lib/calories';
import { parseTargetPace } from '@/lib/parsePace';

interface RunResult {
  id: string;
  xpGained: number;
  coinsGained: number;
  streakDays: number;
  streakMultiplier: number;
  newBadges: { title?: string; name?: string; icon?: string; emoji?: string; description?: string }[];
  newTerritories: number;
  newLevel?: number;
}

const RunMap = dynamic(() => import('@/components/RunMap').then(m => m.RunMap), {
  ssr: false,
  loading: () => <div className="h-[42vh] bg-rq-night animate-pulse rounded-2xl" />,
});

type Point = [number, number];

export default function RunTrackingPage() {
  const router = useRouter();
  const { toast, confirm } = useToast();
  const [state, setState] = useState<'idle' | 'tracking' | 'paused' | 'done'>('idle');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [current, setCurrent] = useState<Point | null>(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [currentSpeedMs, setCurrentSpeedMs] = useState<number | null>(null);
  const [elevGain, setElevGain] = useState(0);
  const [elevLoss, setElevLoss] = useState(0);
  const [autoPausedHint, setAutoPausedHint] = useState(false);
  const [targetPace, setTargetPace] = useState(0);
  const [targetPaceInput, setTargetPaceInput] = useState('');
  const [liveSplits, setLiveSplits] = useState<{ km: number; paceSecPerKm: number }[]>([]);
  const [recovered, setRecovered] = useState<ActiveRun | null>(null);
  const [workout, setWorkout] = useState<{ id: string; name: string; segments: RawSegment[] } | null>(null);
  const [workoutList, setWorkoutList] = useState<{ id: string; name: string }[]>([]);
  // Fantasma / parceiro virtual
  const [ghostPace, setGhostPace] = useState(0); // s/km, 0 = desligado
  const [ghostLabel, setGhostLabel] = useState('');
  const [ghostTargetM, setGhostTargetM] = useState(0); // linha de chegada (0 = aberto)
  const [prs, setPrs] = useState<{ label: string; best: { paceSecPerKm: number; distanceMeters: number; durationSec: number } | null }[]>([]);
  const ghostAheadRef = useRef<boolean | null>(null);
  const ghostFinishedRef = useRef(false);

  const hr = useHeartRate();
  const cad = useCadence();
  // O engine de intervalo segue o estado da corrida: avança em 'tracking', congela em 'paused'.
  const wk = useWorkoutEngine(workout?.segments ?? null, { controlledRunning: state === 'tracking' });
  const workoutActive = !!workout;
  // Sem voz duelando: com treino ativo, o coach de km cala (o engine já narra).
  useAudioCoach(distance, duration, state === 'tracking' && !workoutActive);

  const loadWorkout = useCallback((id: string) => {
    api.get<{ id: string; name: string; segments: RawSegment[] } | null>(`/workouts/${id}`)
      .then((w) => { if (w?.segments) setWorkout(w); })
      .catch(() => {});
  }, []);

  // Deep-link ?workout=<id> (ex.: botão "Correr com GPS" na tela de treinos)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('workout');
    if (id) loadWorkout(id);
  }, [loadWorkout]);

  // Lista de treinos p/ o seletor no idle
  useEffect(() => {
    if (state !== 'idle') return;
    type WorkoutListItem = { id: string; name: string };
    api.get<WorkoutListItem[] | { items?: WorkoutListItem[] }>('/workouts')
      .then((d) => setWorkoutList(Array.isArray(d) ? d : (d?.items ?? [])))
      .catch(() => {});
  }, [state]);

  // PRs p/ escolher um fantasma (seu recorde) no idle
  useEffect(() => {
    if (state !== 'idle') return;
    api.get<unknown>('/runs/stats/prs')
      .then((d) => setPrs(Array.isArray(d) ? d : []))
      .catch(() => setPrs([]));
  }, [state]);

  // Fantasma só corre quando não há treino ativo (evita duelo de vozes)
  const ghostActive = ghostPace > 0 && !workout;
  const ghost = ghostActive
    ? ghostProgress({ elapsedSec: duration, youMeters: distance, ghostPaceSecPerKm: ghostPace, targetDistanceM: ghostTargetM || undefined })
    : null;

  // Narra ultrapassagens e a chegada
  useEffect(() => {
    if (!ghost || state !== 'tracking') return;
    const phrase = leadChangeCallout(ghostAheadRef.current, ghost);
    if (Math.abs(ghost.gapMeters) >= 8) ghostAheadRef.current = ghost.ahead;
    if (phrase) {
      speak(phrase);
      try { navigator.vibrate?.(ghost.ahead ? [120, 60, 120] : 200); } catch {}
    }
    if (ghost.finished && !ghostFinishedRef.current) {
      ghostFinishedRef.current = true;
      speak(finishCallout(ghost));
      try { navigator.vibrate?.([120, 60, 120, 60, 240]); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distance, duration, ghostActive]);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const watchId = useRef<GeoWatchHandle | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const distRef = useRef(0);
  const durationRef = useRef(0);
  // Cronometragem ancorada em wall-clock: duração = base acumulada + (agora -
  // início do segmento atual). Sobrevive ao throttle de setInterval quando a
  // aba vai pro fundo (senão a corrida grava menos tempo e pace falso-rápido).
  const durationBaseRef = useRef(0);
  const segStartRef = useRef(0);
  const lastKmDistRef = useRef(0);
  const lastKmTimeRef = useRef(0);
  const lastAltRef = useRef<number | null>(null);
  const elevGainRef = useRef(0);
  const elevLossRef = useRef(0);
  const stateRef = useRef<string>('idle');
  const lowSpeedRef = useRef(0);
  const targetPaceRef = useRef(0);
  const saveCounterRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { targetPaceRef.current = targetPace; }, [targetPace]);

  /** Grava o estado atual da corrida no localStorage (recuperação a frio). */
  const persistProgress = useCallback(() => {
    if (!startedAt || pointsRef.current.length < 2) return;
    saveActiveRun({
      startedAt: startedAt.toISOString(),
      points: pointsRef.current,
      distance: distRef.current,
      duration: durationRef.current,
      elevGain: elevGainRef.current,
      elevLoss: elevLossRef.current,
      targetPace: targetPaceRef.current,
    });
  }, [startedAt]);

  useEffect(() => {
    if (!tokens.hasSession()) router.replace('/auth/login');
  }, [router]);

  useEffect(() => {
    if (state !== 'idle') return;
    navigator.geolocation?.getCurrentPosition(
      p => { setCurrent([p.coords.latitude, p.coords.longitude]); setGpsAccuracy(p.coords.accuracy); },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [state]);

  // Recuperação a frio: detecta uma corrida em andamento salva (queda/reload/telefone reiniciou)
  useEffect(() => {
    const saved = loadActiveRun();
    if (saved) setRecovered(saved);
  }, []);

  // Salva ao sair/ocultar a aba — última chance antes do navegador descartar o estado
  useEffect(() => {
    const flush = () => { if (stateRef.current === 'tracking' || stateRef.current === 'paused') persistProgress(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [persistProgress]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && stateRef.current === 'tracking') {
        navigator.wakeLock?.request('screen').then(wl => { wakeLockRef.current = wl; }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Cleanup ao desmontar (ex.: usuário navega pra fora no meio da corrida):
  // encerra GPS watch, o tick e libera o wake lock — senão vazam e disparam
  // setState em componente desmontado + GPS/tela ligados sem ninguém consumindo.
  useEffect(() => () => {
    if (watchId.current) { watchId.current.clear(); watchId.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});
  }, []);

  const start = useCallback((fresh = true) => {
    if (!navigator.geolocation) { setError('GPS indisponível'); return; }
    setError(null);
    // Defensivo: nunca deixar watch/tick antigos vivos ao (re)iniciar — senão
    // dois intervalos incrementariam a duração em dobro.
    if (watchId.current) { watchId.current.clear(); watchId.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    // Só zera tudo numa corrida NOVA. Ao retomar (pausa ou recuperação)
    // preservamos distância, tempo, pontos e elevação acumulados.
    if (fresh) {
      setPoints([]); pointsRef.current = [];
      setDistance(0); distRef.current = 0;
      setDuration(0); durationRef.current = 0;
      setLiveSplits([]);
      setElevGain(0); elevGainRef.current = 0;
      setElevLoss(0); elevLossRef.current = 0;
      lastKmDistRef.current = 0;
      lastKmTimeRef.current = 0;
      ghostAheadRef.current = null;
      ghostFinishedRef.current = false;
    }
    lastAltRef.current = null;
    lowSpeedRef.current = 0;
    setAutoPausedHint(false);
    setCurrentSpeedMs(null);
    if (fresh || !startedAt) setStartedAt(new Date());
    // Âncora do relógio: base = tempo já acumulado; segmento começa agora.
    durationBaseRef.current = durationRef.current;
    segStartRef.current = Date.now();
    setState('tracking'); stateRef.current = 'tracking';

    // Screen wake lock — só no PWA. No app nativo o plugin de background
    // mantém o GPS vivo mesmo com a tela apagada, então não forçamos a tela ligada.
    if (!isNativePlatform()) {
      navigator.wakeLock?.request('screen').then(wl => { wakeLockRef.current = wl; }).catch(() => {});
    }

    watchId.current = geoWatch(
      (fix) => {
        const acc = fix.accuracy;
        setGpsAccuracy(acc);

        // GPS Doppler speed — much more accurate than position diff
        const spd = fix.speed;
        if (spd !== null && spd !== undefined && acc < 50) {
          setCurrentSpeedMs(spd);
          if (spd < 0.4) {
            lowSpeedRef.current++;
            if (lowSpeedRef.current >= 8) setAutoPausedHint(true);
          } else {
            lowSpeedRef.current = 0;
            setAutoPausedHint(false);
          }
        }

        // Elevation (filtros puros: gate de precisão vertical + banda de delta)
        const alt = fix.altitude;
        const altAcc = fix.altitudeAccuracy;
        if (alt != null) {
          const { gain, loss } = elevationStep(lastAltRef.current, alt, altAcc ?? null);
          if (gain > 0) { elevGainRef.current += gain; setElevGain(Math.round(elevGainRef.current)); }
          if (loss > 0) { elevLossRef.current += loss; setElevLoss(Math.round(elevLossRef.current)); }
          if (altAcc == null || altAcc < 25) lastAltRef.current = alt;
        }

        if (!isAcceptableFix(acc)) return;

        const p: Point = [fix.latitude, fix.longitude];
        const prev = pointsRef.current[pointsRef.current.length - 1];
        if (prev) {
          const step = acceptStep(haversine(prev, p));
          if (step === null) return; // jitter parado ou salto de GPS
          distRef.current += step;
          setDistance(distRef.current);

          const prevKm = Math.floor(lastKmDistRef.current / 1000);
          const currKm = Math.floor(distRef.current / 1000);
          if (currKm > prevKm && currKm > 0) {
            const dur = durationRef.current;
            const sp = splitPace(dur, lastKmTimeRef.current, distRef.current, lastKmDistRef.current);
            lastKmDistRef.current = distRef.current;
            lastKmTimeRef.current = dur;
            setLiveSplits(s => [...s.slice(-4), { km: currKm, paceSecPerKm: sp }]);
          }
        }
        pointsRef.current.push(p);
        setPoints([...pointsRef.current]);
        setCurrent(p);
      },
      (msg) => setError(msg),
    );

    tickRef.current = setInterval(() => {
      if (stateRef.current === 'tracking') {
        // Recalcula do relógio: correto mesmo se o tick foi throttled em background.
        const n = elapsedSec(durationBaseRef.current, segStartRef.current, Date.now());
        durationRef.current = n; setDuration(n);
        // Auto-save a cada 5s para recuperação a frio (throttle p/ não pesar)
        if ((saveCounterRef.current = (saveCounterRef.current + 1) % 5) === 0) persistProgress();
      }
    }, 1000);
  }, [startedAt, persistProgress]);

  const pause = useCallback(() => {
    // Flush do relógio ANTES de congelar: captura a fração desde o último tick de
    // 1 s — senão cada pausa perdia até ~1 s (acumula com muitas paradas).
    if (stateRef.current === 'tracking') {
      const n = elapsedSec(durationBaseRef.current, segStartRef.current, Date.now());
      durationRef.current = n; setDuration(n);
    }
    setState('paused'); stateRef.current = 'paused';
    if (watchId.current != null) { watchId.current.clear(); watchId.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});
    persistProgress();
  }, [persistProgress]);

  const resume = useCallback(() => {
    start(false);
  }, [start]);

  const stop = async () => {
    // Flush do relógio se ainda estava correndo — captura o último trecho antes
    // de ler a duração final (parar no meio de um tick perderia até ~1 s).
    if (stateRef.current === 'tracking') {
      durationRef.current = elapsedSec(durationBaseRef.current, segStartRef.current, Date.now());
    }
    if (watchId.current != null) { watchId.current.clear(); watchId.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});

    const finalDur = durationRef.current;
    const finalDist = distRef.current;

    if (pointsRef.current.length < 2 || finalDist < 50) {
      if (!(await confirm('Corrida muito curta. Descartar?', 'Descartar'))) { setState('paused'); stateRef.current = 'paused'; return; }
      reset(); return;
    }
    setState('done'); stateRef.current = 'done';

    const pace = finalDist > 0 ? Math.round((finalDur * 1000) / finalDist) : 0;
    const avgSpeedKmh = finalDist > 0 ? Math.round((finalDist / finalDur) * 3.6 * 10) / 10 : 0;

    try {
      // Via api.post: se o token expirou, renova e REPETE — antes o fetch cru
      // falhava e o usuário perdia a corrida recém-terminada.
      const run = await api.post<RunResult>('/runs', {
        startedAt: startedAt!.toISOString(),
        endedAt: new Date(startedAt!.getTime() + finalDur * 1000).toISOString(),
        distanceMeters: finalDist,
        durationSec: finalDur,
        avgPaceSecPerKm: pace,
        elevationGainM: elevGainRef.current > 1 ? Math.round(elevGainRef.current) : undefined,
        elevationLossM: elevLossRef.current > 1 ? Math.round(elevLossRef.current) : undefined,
        avgSpeedKmh,
        pointsGeoJson: { type: 'LineString', coordinates: pointsRef.current.map(([la, ln]) => [ln, la]) },
        source: 'GPS',
        opId: `run-${Date.now()}`,
      });
      if (!run?.id) throw new Error('Resposta inválida');
      clearActiveRun();
      haptic(SUCCESS); // vibração de recompensa quando a modal de conquistas aparece
      setRunResult(run);
    } catch (e) {
      setState('paused'); stateRef.current = 'paused';
      toast('Erro ao salvar: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const reset = () => {
    setState('idle'); stateRef.current = 'idle';
    setPoints([]); pointsRef.current = [];
    setDistance(0); distRef.current = 0;
    setDuration(0); durationRef.current = 0;
    setStartedAt(null); setCurrentSpeedMs(null);
    setElevGain(0); elevGainRef.current = 0;
    setElevLoss(0); elevLossRef.current = 0;
    clearActiveRun();
  };

  /** Restaura uma corrida recuperada e volta a rastrear de onde parou. */
  const resumeRecovered = useCallback(() => {
    if (!recovered) return;
    pointsRef.current = recovered.points;
    setPoints([...recovered.points]);
    setCurrent(recovered.points[recovered.points.length - 1] ?? null);
    distRef.current = recovered.distance; setDistance(recovered.distance);
    durationRef.current = recovered.duration; setDuration(recovered.duration);
    elevGainRef.current = recovered.elevGain; setElevGain(Math.round(recovered.elevGain));
    elevLossRef.current = recovered.elevLoss; setElevLoss(Math.round(recovered.elevLoss));
    lastKmDistRef.current = Math.floor(recovered.distance / 1000) * 1000;
    lastKmTimeRef.current = recovered.duration;
    if (recovered.targetPace > 0) {
      setTargetPace(recovered.targetPace);
      setTargetPaceInput(formatPace(recovered.targetPace));
    }
    setStartedAt(new Date(recovered.startedAt));
    setRecovered(null);
    // Pausado: o usuário toca ▶ para voltar a rastrear preservando o acumulado
    setState('paused'); stateRef.current = 'paused';
  }, [recovered]);

  const discardRecovered = useCallback(() => {
    clearActiveRun();
    setRecovered(null);
  }, []);

  // Pace: prefer GPS Doppler speed, fall back to accumulated distance/time
  const currentPace = currentSpeedMs !== null && currentSpeedMs > 0.3 ? Math.round(1000 / currentSpeedMs) : 0;
  const avgPace = distance > 100 && duration > 0 ? Math.round((duration * 1000) / distance) : 0;
  const displayPace = currentPace > 0 ? currentPace : avgPace;
  const kmh = currentSpeedMs != null && currentSpeedMs > 0.3
    ? (currentSpeedMs * 3.6).toFixed(1)
    : distance > 100 && duration > 0 ? ((distance / duration) * 3.6).toFixed(1) : null;

  const paceStatus = targetPace > 0 && displayPace > 0
    ? displayPace < targetPace * 0.97 ? 'fast' : displayPace > targetPace * 1.03 ? 'slow' : 'on'
    : 'none';

  // Estático por sessão — evita JSON.parse do localStorage a cada render (a tela
  // re-renderiza a cada fix de GPS e a cada segundo).
  const weightKg = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('rq.settings') ?? '{}').weightKg || 70; } catch { return 70; }
  }, []);
  const calories = estimateCalories(distance, weightKg);
  const signal = gpsSignal(gpsAccuracy);

  return (
    <main className="min-h-screen bg-rq-aurora flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/90 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold text-sm">Corrida</h1>
          <div className="flex items-center gap-1 ml-1" title={gpsAccuracy ? `±${Math.round(gpsAccuracy)}m` : 'Sem GPS'}>
            <Navigation className="w-3 h-3 text-white/30" />
            {[1,2,3,4].map(i => (
              <div key={i} className={`w-1 rounded-full transition-all ${i <= signal ? 'bg-rq-lime' : 'bg-white/15'}`}
                style={{ height: `${3 + i * 2}px` }} />
            ))}
            {gpsAccuracy && <span className="text-[9px] text-white/30 ml-0.5">±{Math.round(gpsAccuracy)}m</span>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={cad.connected ? cad.disconnect : cad.connect}
              className={`flex items-center gap-1 text-xs ${cad.connected ? 'text-rq-emerald' : 'text-white/40'}`}
              title="Sensor de cadência/velocidade Bluetooth">
              <Footprints className={`w-3.5 h-3.5 ${cad.connected ? 'animate-pulse' : ''}`} />
              {cad.reading?.cadenceSpm ? <span className="tabular-nums font-bold">{cad.reading.cadenceSpm}</span> : <span>SPM</span>}
            </button>
            <button onClick={hr.connected ? hr.disconnect : hr.connect}
              className={`flex items-center gap-1 text-xs ${hr.connected ? 'text-rq-orange' : 'text-white/40'}`}>
              <Heart className={`w-3.5 h-3.5 ${hr.connected ? 'fill-current animate-pulse' : ''}`} />
              {hr.bpm ? <span className="tabular-nums font-bold">{hr.bpm}</span> : <span>HR</span>}
            </button>
          </div>
        </div>
      </header>

      <RunMap positions={points} current={current} height="42vh" />

      {recovered && state === 'idle' && (
        <div className="bg-rq-lime/10 border-b border-rq-lime/20 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Activity className="w-5 h-5 text-rq-lime shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-rq-lime">Corrida em andamento recuperada</div>
              <div className="text-xs text-white/60">
                {formatDistance(recovered.distance)} km · {formatDuration(recovered.duration)} salvos. Continuar de onde parou?
              </div>
            </div>
            <button onClick={resumeRecovered}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rq-lime text-rq-ink text-xs font-bold hover:scale-105 active:scale-95 transition">
              Retomar
            </button>
            <button onClick={discardRecovered}
              className="shrink-0 text-white/40 text-xs hover:text-white/70">Descartar</button>
          </div>
        </div>
      )}

      {error && <div className="bg-rq-orange/20 text-rq-orange px-4 py-1.5 text-xs text-center">{error}</div>}
      {autoPausedHint && state === 'tracking' && (
        <div className="bg-yellow-500/15 text-yellow-300 px-4 py-1 text-xs text-center">
          ⏸ Parado detectado — toque Pausar se quiser interromper
        </div>
      )}

      <section className="flex-1 px-4 py-4 max-w-5xl mx-auto w-full space-y-3">

        {/* Overlay do treino intervalado — o diferencial vs. INTVL: intervalo guiado por
            voz rodando JUNTO com GPS/mapa/territórios. */}
        {workoutActive && (state === 'tracking' || state === 'paused') && wk.cur && (
          <div className="glass p-4 border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] uppercase tracking-widest text-cyan-200/90 font-bold flex items-center gap-2">
                {wk.cur.label}
                {wk.cur.isLastRep && (
                  <span className="px-1.5 py-0.5 rounded-full bg-cyan-400/25 text-[9px]">ÚLTIMA</span>
                )}
              </div>
              <div className="text-[10px] text-white/40 tabular-nums">
                {wk.idx + 1}/{wk.steps.length}
              </div>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="font-display text-5xl font-black tabular-nums leading-none">
                {Math.floor(wk.remaining / 60)}:{String(wk.remaining % 60).padStart(2, '0')}
              </div>
              {wk.next && (
                <div className="text-right text-[11px] text-white/50 pb-1">
                  próximo<br />
                  <span className="text-white/80 font-bold">{wk.next.label}</span> · {formatDuration(wk.next.durationSec)}
                </div>
              )}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-cyan-300 transition-[width] duration-500 ease-linear"
                style={{ width: `${wk.progress * 100}%` }} />
            </div>
          </div>
        )}

        {/* Overlay do FANTASMA — corrida ao vivo contra o seu recorde/pace-alvo.
            Nem Strava nem INTVL fazem isso ao vivo. */}
        {ghost && (state === 'tracking' || state === 'paused') && (
          <div className={`glass p-4 border ${ghost.ahead ? 'border-rq-lime/40 bg-gradient-to-br from-rq-lime/10 to-transparent' : 'border-rq-orange/40 bg-gradient-to-br from-rq-orange/10 to-transparent'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-widest font-bold text-white/70 flex items-center gap-1.5">
                👻 vs {ghostLabel}
              </div>
              <div className={`text-sm font-black tabular-nums ${ghost.ahead ? 'text-rq-lime' : 'text-rq-orange'}`}>
                {ghost.ahead ? '▲' : '▼'} {Math.abs(ghost.gapMeters)} m
                <span className="text-[11px] font-normal text-white/50 ml-1">
                  ({ghost.ahead ? '+' : '−'}{formatDuration(Math.abs(ghost.gapSec))})
                </span>
              </div>
            </div>
            {/* Pista: você (lime) e fantasma (branco) */}
            <div className="space-y-1.5">
              {[{ who: 'você', m: ghost.youMeters, color: 'bg-rq-lime', emoji: '🏃' }, { who: 'fantasma', m: ghost.ghostMeters, color: 'bg-white/50', emoji: '👻' }].map((lane) => {
                const denom = ghostTargetM > 0 ? ghostTargetM : Math.max(ghost.youMeters, ghost.ghostMeters, 1);
                const pct = Math.min(100, (lane.m / denom) * 100);
                return (
                  <div key={lane.who} className="relative h-5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 ${lane.color} rounded-full transition-[width] duration-700 ease-linear`} style={{ width: `${pct}%` }} />
                    <span className="absolute top-1/2 -translate-y-1/2 text-xs" style={{ left: `calc(${pct}% - 10px)` }}>{lane.emoji}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-white/40 mt-1.5 tabular-nums">
              {ghostTargetM > 0 ? `alvo ${(ghostTargetM / 1000).toFixed(1)} km · ` : ''}fantasma a {formatPace(ghostPace)}/km
            </div>
          </div>
        )}

        {/* Primary: Time + Distance (always accurate) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Tempo</div>
            <div className="font-display text-4xl font-black tabular-nums leading-none">{formatDuration(duration)}</div>
          </div>
          <div className="glass p-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Distância</div>
            <div className="font-display text-4xl font-black tabular-nums leading-none">{formatDistance(distance)}</div>
            <div className="text-[10px] text-white/30 mt-0.5">km</div>
          </div>
        </div>

        {/* Pace: current (GPS speed) + avg */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`glass p-4 border ${
            paceStatus === 'fast' ? 'border-rq-lime/50' :
            paceStatus === 'slow' ? 'border-rq-orange/50' :
            paceStatus === 'on' ? 'border-cyan-400/50' : 'border-transparent'
          }`}>
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              Ritmo atual
              {currentSpeedMs !== null && currentSpeedMs > 0.3 && <span className="text-rq-lime/70 text-[8px]">● GPS</span>}
            </div>
            <div className={`font-display text-4xl font-black tabular-nums leading-none ${
              paceStatus === 'fast' ? 'text-rq-lime' :
              paceStatus === 'slow' ? 'text-rq-orange' :
              paceStatus === 'on' ? 'text-cyan-300' : ''
            }`}>
              {currentPace > 0 ? formatPace(currentPace) : state === 'tracking' ? '--:--' : formatPace(avgPace)}
            </div>
            <div className="text-[10px] mt-0.5">
              {paceStatus === 'fast' && <span className="text-rq-lime">▲ acima do alvo</span>}
              {paceStatus === 'slow' && <span className="text-rq-orange">▼ abaixo do alvo</span>}
              {paceStatus === 'on' && <span className="text-cyan-300">✓ no alvo</span>}
              {paceStatus === 'none' && <span className="text-white/30">min/km</span>}
            </div>
          </div>
          <div className="glass p-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Ritmo médio</div>
            <div className="font-display text-4xl font-black tabular-nums leading-none text-white/80">
              {avgPace > 0 ? formatPace(avgPace) : '--:--'}
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">min/km</div>
          </div>
        </div>

        {/* Secondary stats row */}
        {(state === 'tracking' || state === 'paused') && (
          <div className={`grid gap-2 ${cad.connected ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <div className="glass p-2.5 text-center">
              <div className="text-[9px] text-white/40 mb-0.5">km/h</div>
              <div className="font-display text-base font-black tabular-nums">{kmh ?? '—'}</div>
            </div>
            <div className="glass p-2.5 text-center">
              <div className="text-[9px] text-white/40 mb-0.5 flex items-center justify-center gap-0.5"><Mountain className="w-2.5 h-2.5" /> elev</div>
              <div className="font-display text-base font-black tabular-nums">
                <span className="text-rq-lime">{elevGain > 0 ? `+${elevGain}` : '—'}</span>
                {elevLoss > 0 && <span className="text-rq-orange text-sm"> /-{elevLoss}</span>}
              </div>
              <div className="text-[9px] text-white/30">m</div>
            </div>
            <div className="glass p-2.5 text-center">
              <div className="text-[9px] text-white/40 mb-0.5">kcal</div>
              <div className="font-display text-base font-black text-rq-orange tabular-nums">
                {calories > 0 ? calories : '—'}
              </div>
            </div>
            <div className="glass p-2.5 text-center">
              <div className="text-[9px] text-white/40 mb-0.5">bpm</div>
              <div className={`font-display text-base font-black tabular-nums ${hr.bpm ? 'text-red-400 animate-pulse' : 'text-white/30'}`}>
                {hr.bpm ?? '—'}
              </div>
            </div>
            {cad.connected && (
              <div className="glass p-2.5 text-center">
                <div className="text-[9px] text-white/40 mb-0.5">spm</div>
                <div className="font-display text-base font-black text-rq-emerald tabular-nums">
                  {cad.reading?.cadenceSpm ?? '—'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Target pace bar */}
        {targetPace > 0 && displayPace > 0 && (
          <div className="glass p-3">
            <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
              <span>Alvo: {formatPace(targetPace)}/km</span>
              <span className={paceStatus === 'fast' ? 'text-rq-lime font-bold' : paceStatus === 'slow' ? 'text-rq-orange font-bold' : 'text-cyan-300 font-bold'}>
                {paceStatus === 'fast' ? `▲ ${formatPace(targetPace - displayPace)} mais rápido` :
                 paceStatus === 'slow' ? `▼ ${formatPace(displayPace - targetPace)} mais lento` :
                 '✓ No alvo'}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(5, (targetPace / Math.max(displayPace, 1)) * 100))}%`,
                  background: paceStatus === 'fast' ? '#a3e635' : paceStatus === 'slow' ? '#FF7A1A' : '#67e8f9',
                }} />
            </div>
          </div>
        )}

        {/* Live splits */}
        {liveSplits.length > 0 && (
          <div className="glass p-3">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Splits por km</div>
            <div className="space-y-1.5">
              {liveSplits.slice(-4).map((s, i) => {
                const isFastest = s.paceSecPerKm === Math.min(...liveSplits.map(x => x.paceSecPerKm));
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-white/40 text-xs font-mono w-8">{s.km}km</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(100, (360 / s.paceSecPerKm) * 100)}%`,
                        background: isFastest ? '#a3e635' : 'rgba(163,230,53,0.4)',
                      }} />
                    </div>
                    <span className={`text-xs font-mono font-bold tabular-nums ${isFastest ? 'text-rq-lime' : 'text-white/60'}`}>
                      {Math.floor(s.paceSecPerKm / 60)}:{String(s.paceSecPerKm % 60).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-5 py-2">
          {state === 'idle' && (
            <button onClick={() => { haptic(SUCCESS); start(); }}
              className="w-20 h-20 rounded-full bg-rq-lime text-rq-ink flex flex-col items-center justify-center gap-0.5 shadow-2xl shadow-rq-lime/30 hover:scale-105 active:scale-95 transition">
              <Play className="w-8 h-8 fill-current" />
              <span className="text-xs font-bold">Iniciar</span>
            </button>
          )}
          {state === 'tracking' && (
            <>
              <button onClick={() => { haptic(); pause(); }}
                className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 active:scale-95 transition">
                <Pause className="w-7 h-7" />
              </button>
              <button onClick={() => { haptic(); stop(); }}
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-0.5 text-white shadow-2xl hover:scale-105 active:scale-95 transition"
                style={{ background: 'linear-gradient(135deg,#FF7A1A,#ff3838)' }}>
                <Square className="w-7 h-7 fill-current" />
                <span className="text-xs font-bold">Finalizar</span>
              </button>
            </>
          )}
          {state === 'paused' && (
            <>
              <button onClick={() => { haptic(); resume(); }}
                className="w-16 h-16 rounded-full bg-rq-lime text-rq-ink flex items-center justify-center hover:scale-105 active:scale-95 transition">
                <Play className="w-7 h-7 fill-current" />
              </button>
              <button onClick={() => { haptic(); stop(); }}
                className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex flex-col items-center justify-center gap-0.5 text-sm font-bold hover:bg-white/20 active:scale-95 transition">
                <Square className="w-6 h-6" />
                Salvar
              </button>
            </>
          )}
          {state === 'done' && (
            <div className="flex items-center gap-2 text-rq-lime animate-pulse">
              <Activity className="w-5 h-5" /> Salvando…
            </div>
          )}
        </div>

        {/* Idle config */}
        {state === 'idle' && (
          <div className="space-y-3">
            {/* Seletor de treino intervalado (opcional) */}
            <div className="glass p-4">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-300" /> Treino guiado (opcional)
              </div>
              {workout ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{workout.name}</div>
                    <div className="text-[11px] text-white/40">
                      {workout.segments.reduce((a, s) => a + Math.max(1, s.repeats || 1), 0)} blocos · voz + GPS juntos
                    </div>
                  </div>
                  <button onClick={() => setWorkout(null)} className="text-white/30 text-xs hover:text-white/70">✕ remover</button>
                </div>
              ) : (
                <select
                  value=""
                  onChange={(e) => e.target.value && loadWorkout(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-300/50"
                >
                  <option value="">Correr livre (sem treino)</option>
                  {workoutList.map((w) => (
                    <option key={w.id} value={w.id} className="bg-rq-night">{w.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Fantasma / parceiro virtual — corra contra o seu recorde */}
            <div className="glass p-4">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                👻 Fantasma / parceiro virtual (opcional)
              </div>
              {workout ? (
                <p className="text-xs text-white/40">Desativado com treino guiado — remova o treino para correr contra um fantasma.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setGhostPace(0); setGhostLabel(''); setGhostTargetM(0); ghostAheadRef.current = null; ghostFinishedRef.current = false; }}
                      className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${ghostPace === 0 ? 'bg-white/10 border border-white/20' : 'bg-white/5 border border-white/10 hover:border-white/20 text-white/50'}`}>
                      Nenhum
                    </button>
                    {prs.filter((p) => p.best).map((p) => (
                      <button key={p.label}
                        onClick={() => { setGhostPace(p.best!.paceSecPerKm); setGhostTargetM(p.best!.distanceMeters); setGhostLabel(`recorde ${p.label}`); ghostAheadRef.current = null; ghostFinishedRef.current = false; }}
                        className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${ghostLabel === `recorde ${p.label}` ? 'bg-rq-lime/20 border border-rq-lime/50 text-rq-lime' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}>
                        🏆 {p.label} · {formatPace(p.best!.paceSecPerKm)}
                      </button>
                    ))}
                    {targetPace > 0 && (
                      <button
                        onClick={() => { setGhostPace(targetPace); setGhostTargetM(0); setGhostLabel('pace alvo'); ghostAheadRef.current = null; ghostFinishedRef.current = false; }}
                        className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${ghostLabel === 'pace alvo' ? 'bg-cyan-400/20 border border-cyan-400/50 text-cyan-300' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}>
                        ⚡ Pace alvo · {formatPace(targetPace)}
                      </button>
                    )}
                  </div>
                  {ghostPace > 0
                    ? <div className="text-xs text-rq-lime mt-2">👻 Correndo contra: {ghostLabel} ({formatPace(ghostPace)}/km){ghostTargetM > 0 ? ` até ${(ghostTargetM / 1000).toFixed(1)} km` : ''}</div>
                    : prs.every((p) => !p.best) && <div className="text-[11px] text-white/30 mt-2">Complete corridas para desbloquear fantasmas dos seus recordes — ou defina um pace alvo abaixo.</div>}
                </>
              )}
            </div>

            <div className="glass p-4">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-cyan-300" /> Pace alvo (opcional)
              </div>
              <div className="flex items-center gap-3">
                <input type="text" placeholder="5:30" value={targetPaceInput}
                  onChange={e => { setTargetPaceInput(e.target.value); setTargetPace(parseTargetPace(e.target.value)); }}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center font-mono text-lg font-bold focus:outline-none focus:border-cyan-300/50"
                  maxLength={5} />
                <span className="text-white/40 text-sm">min/km</span>
                {targetPace > 0 && <button onClick={() => { setTargetPace(0); setTargetPaceInput(''); }} className="text-white/30 text-xs">✕</button>}
              </div>
              {targetPace > 0 && <div className="text-xs text-cyan-300 mt-1.5">✓ Alvo: {formatPace(targetPace)}/km</div>}
            </div>
            <p className="text-center text-xs text-white/30">🔒 GPS necessário · Tela permanece acesa</p>
          </div>
        )}
      </section>

      {/* Post-run modal */}
      {runResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label="Corrida concluída"
            className="bg-rq-night border border-white/10 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="text-center">
              <div className="text-5xl mb-2">🏃‍♂️</div>
              <h2 className="font-display text-2xl font-black">Corrida concluída!</h2>
              <div className="text-sm text-white/60 mt-1">
                {formatDistance(distRef.current)} km · {formatDuration(durationRef.current)} · {avgPace > 0 ? formatPace(avgPace) : '--:--'}/km
              </div>
              {elevGainRef.current > 2 && (
                <div className="text-xs text-rq-lime mt-0.5">↑ {Math.round(elevGainRef.current)}m elevação</div>
              )}
              {runResult.newLevel && (
                <div className="mt-2 bg-rq-lime/20 border border-rq-lime/40 rounded-xl px-4 py-2">
                  <span className="text-rq-lime font-bold">🎉 Nível {runResult.newLevel}!</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass p-3 text-center">
                <Zap className="w-4 h-4 text-rq-lime mx-auto mb-1" />
                <div className="font-display text-xl font-black text-rq-lime">+{runResult.xpGained}</div>
                <div className="text-xs text-white/50">XP</div>
                {runResult.streakMultiplier > 1 && <div className="text-xs text-rq-orange">{runResult.streakMultiplier.toFixed(2)}x streak</div>}
              </div>
              <div className="glass p-3 text-center">
                <Star className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                <div className="font-display text-xl font-black text-yellow-400">+{runResult.coinsGained}</div>
                <div className="text-xs text-white/50">RunCoins</div>
              </div>
              {runResult.streakDays > 0 && (
                <div className="glass p-3 text-center">
                  <Flame className="w-4 h-4 text-rq-orange mx-auto mb-1" />
                  <div className="font-display text-xl font-black text-rq-orange">{runResult.streakDays}</div>
                  <div className="text-xs text-white/50">dias seguidos</div>
                </div>
              )}
              {runResult.newTerritories > 0 && (
                <div className="glass p-3 text-center">
                  <MapPin className="w-4 h-4 text-rq-violet mx-auto mb-1" />
                  <div className="font-display text-xl font-black text-rq-violet">+{runResult.newTerritories}</div>
                  <div className="text-xs text-white/50">territórios</div>
                </div>
              )}
            </div>

            {runResult.newBadges?.length > 0 && (
              <div className="glass p-3">
                <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">Conquistas!</div>
                {runResult.newBadges.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 mt-1">
                    <span className="text-xl">{b.icon ?? b.emoji ?? '🏅'}</span>
                    <div>
                      <div className="font-bold text-sm">{b.title ?? b.name}</div>
                      {b.description && <div className="text-xs text-white/50">{b.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <StravaUpload runId={runResult.id} />

            <div className="flex gap-2">
              <button onClick={() => router.replace('/app')} className="flex-1 btn-ghost py-3 text-sm">Início</button>
              <button onClick={() => router.replace(`/app/runs/${runResult.id}`)} className="flex-1 btn-primary py-3 text-sm">
                <Trophy className="w-4 h-4" /> Ver corrida
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
