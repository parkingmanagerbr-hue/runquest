'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, Square, MapPin, Activity, ArrowLeft, Heart, Zap, Trophy, Flame, Star, TrendingUp, Mountain, Navigation } from 'lucide-react';
import Link from 'next/link';
import { tokens } from '@/lib/api';
import { haversine, formatPace, formatDuration, formatDistance } from '@/lib/geo';
import { useHeartRate } from '@/lib/useHeartRate';
import { useAudioCoach } from '@/lib/useAudioCoach';

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

function gpsSignal(accuracy: number | null): 0 | 1 | 2 | 3 | 4 {
  if (!accuracy) return 0;
  if (accuracy <= 5) return 4;
  if (accuracy <= 10) return 3;
  if (accuracy <= 20) return 2;
  if (accuracy <= 40) return 1;
  return 0;
}

function StravaUpload({ runId }: { runId: string }) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  const upload = async () => {
    setStatus('uploading');
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/strava/export/${runId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      });
      const d = await r.json().catch(() => ({}));
      if (d.uploadId || d.activityId) { setStatus('done'); return; }
      if (r.status === 401 || r.status === 404) { return; } // not connected, silently skip
      setStatus('error');
    } catch { setStatus('error'); }
  };

  if (status === 'done') return (
    <div className="flex items-center gap-2 text-sm text-rq-lime bg-rq-lime/10 border border-rq-lime/20 rounded-xl px-4 py-2.5">
      ✓ Enviado pro Strava!
    </div>
  );

  return (
    <button onClick={upload} disabled={status === 'uploading'}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#FC4C02]/40 bg-[#FC4C02]/10 text-[#FC4C02] text-sm font-bold hover:bg-[#FC4C02]/20 transition disabled:opacity-50">
      {status === 'uploading' ? <><span className="animate-spin inline-block">↻</span> Enviando…</> :
       status === 'error' ? <>⚠ Falhou — Tentar novamente</> :
       <><TrendingUp className="w-4 h-4" /> Enviar pro Strava</>}
    </button>
  );
}

export default function RunTrackingPage() {
  const router = useRouter();
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

  const hr = useHeartRate();
  useAudioCoach(distance, duration, state === 'tracking');

  const wakeLockRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const distRef = useRef(0);
  const durationRef = useRef(0);
  const lastKmDistRef = useRef(0);
  const lastKmTimeRef = useRef(0);
  const lastAltRef = useRef<number | null>(null);
  const elevGainRef = useRef(0);
  const elevLossRef = useRef(0);
  const stateRef = useRef<string>('idle');
  const lowSpeedRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);

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

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && stateRef.current === 'tracking') {
        navigator.wakeLock?.request('screen').then(wl => { wakeLockRef.current = wl; }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) { setError('GPS indisponível'); return; }
    setError(null);
    setPoints([]); pointsRef.current = [];
    setDistance(0); distRef.current = 0;
    setDuration(0); durationRef.current = 0;
    setLiveSplits([]);
    setElevGain(0); elevGainRef.current = 0;
    setElevLoss(0); elevLossRef.current = 0;
    lastAltRef.current = null;
    lastKmDistRef.current = 0;
    lastKmTimeRef.current = 0;
    lowSpeedRef.current = 0;
    setAutoPausedHint(false);
    setCurrentSpeedMs(null);
    if (!startedAt) setStartedAt(new Date());
    setState('tracking'); stateRef.current = 'tracking';

    // Screen wake lock
    navigator.wakeLock?.request('screen').then(wl => { wakeLockRef.current = wl; }).catch(() => {});

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        setGpsAccuracy(acc);

        // GPS Doppler speed — much more accurate than position diff
        const spd = pos.coords.speed;
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

        // Elevation
        const alt = pos.coords.altitude;
        const altAcc = pos.coords.altitudeAccuracy;
        if (alt != null && (altAcc == null || altAcc < 25)) {
          if (lastAltRef.current !== null) {
            const delta = alt - lastAltRef.current;
            if (Math.abs(delta) > 0.3 && Math.abs(delta) < 30) {
              if (delta > 0) { elevGainRef.current += delta; setElevGain(Math.round(elevGainRef.current)); }
              else { elevLossRef.current += Math.abs(delta); setElevLoss(Math.round(elevLossRef.current)); }
            }
          }
          lastAltRef.current = alt;
        }

        if (acc > 35) return;

        const p: Point = [pos.coords.latitude, pos.coords.longitude];
        const prev = pointsRef.current[pointsRef.current.length - 1];
        if (prev) {
          const d = haversine(prev, p);
          if (d < 1.5 || d > 60) return;
          distRef.current += d;
          setDistance(distRef.current);

          const prevKm = Math.floor(lastKmDistRef.current / 1000);
          const currKm = Math.floor(distRef.current / 1000);
          if (currKm > prevKm && currKm > 0) {
            const dur = durationRef.current;
            const sp = Math.round((dur - lastKmTimeRef.current) * 1000 / (distRef.current - lastKmDistRef.current));
            lastKmDistRef.current = distRef.current;
            lastKmTimeRef.current = dur;
            setLiveSplits(s => [...s.slice(-4), { km: currKm, paceSecPerKm: sp }]);
          }
        }
        pointsRef.current.push(p);
        setPoints([...pointsRef.current]);
        setCurrent(p);
      },
      e => setError('GPS: ' + e.message),
      { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 },
    );

    tickRef.current = setInterval(() => {
      if (stateRef.current === 'tracking') {
        setDuration(d => { const n = d + 1; durationRef.current = n; return n; });
      }
    }, 1000);
  }, [startedAt]);

  const pause = useCallback(() => {
    setState('paused'); stateRef.current = 'paused';
    if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});
  }, []);

  const resume = useCallback(() => {
    start();
  }, [start]);

  const stop = async () => {
    if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});

    const finalDur = durationRef.current;
    const finalDist = distRef.current;

    if (pointsRef.current.length < 2 || finalDist < 50) {
      if (!confirm('Corrida muito curta. Descartar?')) { setState('paused'); stateRef.current = 'paused'; return; }
      reset(); return;
    }
    setState('done'); stateRef.current = 'done';

    const pace = finalDist > 0 ? Math.round((finalDur * 1000) / finalDist) : 0;
    const avgSpeedKmh = finalDist > 0 ? Math.round((finalDist / finalDur) * 3.6 * 10) / 10 : 0;

    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
        body: JSON.stringify({
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
        }),
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const run = await r.json();
      if (!run?.id) throw new Error('Resposta inválida');
      setRunResult(run);
    } catch (e: any) {
      setState('paused'); stateRef.current = 'paused';
      alert('Erro ao salvar: ' + e.message);
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
  };

  const parseTargetPace = (s: string) => {
    const m = s.match(/^(\d+):(\d{2})$/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
  };

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

  const weightKg = (() => { try { return JSON.parse(localStorage.getItem('rq.settings') ?? '{}').weightKg || 70; } catch { return 70; } })();
  const calories = Math.round(distance / 1000 * weightKg * 1.036);
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
            <button onClick={hr.connected ? hr.disconnect : hr.connect}
              className={`flex items-center gap-1 text-xs ${hr.connected ? 'text-rq-orange' : 'text-white/40'}`}>
              <Heart className={`w-3.5 h-3.5 ${hr.connected ? 'fill-current animate-pulse' : ''}`} />
              {hr.bpm ? <span className="tabular-nums font-bold">{hr.bpm}</span> : <span>HR</span>}
            </button>
          </div>
        </div>
      </header>

      <RunMap positions={points} current={current} height="42vh" />

      {error && <div className="bg-rq-orange/20 text-rq-orange px-4 py-1.5 text-xs text-center">{error}</div>}
      {autoPausedHint && state === 'tracking' && (
        <div className="bg-yellow-500/15 text-yellow-300 px-4 py-1 text-xs text-center">
          ⏸ Parado detectado — toque Pausar se quiser interromper
        </div>
      )}

      <section className="flex-1 px-4 py-4 max-w-5xl mx-auto w-full space-y-3">

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
          <div className="grid grid-cols-4 gap-2">
            <div className="glass p-2.5 text-center">
              <div className="text-[9px] text-white/40 mb-0.5">km/h</div>
              <div className="font-display text-base font-black tabular-nums">{kmh ?? '—'}</div>
            </div>
            <div className="glass p-2.5 text-center">
              <div className="text-[9px] text-white/40 mb-0.5 flex items-center justify-center gap-0.5">↑elev</div>
              <div className="font-display text-base font-black text-rq-lime tabular-nums">
                {elevGain > 0 ? `+${elevGain}` : '—'}
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
            <button onClick={start}
              className="w-20 h-20 rounded-full bg-rq-lime text-rq-ink flex flex-col items-center justify-center gap-0.5 shadow-2xl shadow-rq-lime/30 hover:scale-105 active:scale-95 transition">
              <Play className="w-8 h-8 fill-current" />
              <span className="text-xs font-bold">Iniciar</span>
            </button>
          )}
          {state === 'tracking' && (
            <>
              <button onClick={pause}
                className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 active:scale-95 transition">
                <Pause className="w-7 h-7" />
              </button>
              <button onClick={stop}
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-0.5 text-white shadow-2xl hover:scale-105 active:scale-95 transition"
                style={{ background: 'linear-gradient(135deg,#FF7A1A,#ff3838)' }}>
                <Square className="w-7 h-7 fill-current" />
                <span className="text-xs font-bold">Finalizar</span>
              </button>
            </>
          )}
          {state === 'paused' && (
            <>
              <button onClick={resume}
                className="w-16 h-16 rounded-full bg-rq-lime text-rq-ink flex items-center justify-center hover:scale-105 active:scale-95 transition">
                <Play className="w-7 h-7 fill-current" />
              </button>
              <button onClick={stop}
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
          <div className="bg-rq-night border border-white/10 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
