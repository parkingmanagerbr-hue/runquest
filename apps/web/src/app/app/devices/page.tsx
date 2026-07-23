'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Watch, Bluetooth, Link2, CheckCircle2, ExternalLink, Heart, Smartphone, Footprints } from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useHeartRate } from '@/lib/useHeartRate';
import { useCadence } from '@/lib/useCadence';

export default function DevicesPage() {
  const router = useRouter();
  const { confirm } = useToast();
  const [strava, setStrava] = useState<{ connected: boolean; athleteId?: string | null } | null>(null);
  // Mesmos hooks BLE usados na tela de corrida (/app/run) — funcionam com
  // qualquer dispositivo do serviço padrão de FC ou cadência/velocidade, de
  // qualquer fabricante (Polar, Garmin, Wahoo, Coros, Stryd…). Obs.: a conexão
  // é por página (não persiste ao navegar); reconecte na tela de corrida.
  const hr = useHeartRate();
  const cad = useCadence();

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.stravaStatus().then(setStrava).catch(() => {});
  }, [router]);

  const connectStrava = async () => {
    const { url } = await api.stravaAuthorizeUrl();
    window.location.href = url;
  };

  const disconnectStrava = async () => {
    if (!(await confirm('Desconectar Strava?', 'Desconectar'))) return;
    await api.stravaDisconnect();
    setStrava({ connected: false });
  };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Dispositivos</h1>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Amazfit / Relógios via Strava */}
        <div className="glass p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-violet to-blue-600 flex items-center justify-center shrink-0">
              <Watch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold">Amazfit / Garmin / Apple Watch / Polar</h2>
              <p className="text-sm text-white/60 mt-0.5">Sincronize via Strava — todas as corridas chegam automaticamente.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-rq-lime/20 text-rq-lime flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
              <div>
                <p className="font-medium">Conecte seu relógio ao app oficial</p>
                <p className="text-white/50">Amazfit → Zepp | Garmin → Garmin Connect | Apple Watch → Saúde</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-rq-lime/20 text-rq-lime flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
              <div>
                <p className="font-medium">Ative a sincronização com o Strava</p>
                <p className="text-white/50">Zepp App → Configurações → Strava → Ativar sync automático</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-rq-lime/20 text-rq-lime flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
              <div>
                <p className="font-medium">Conecte o Strava aqui embaixo ↓</p>
                <p className="text-white/50">Cada corrida do relógio chega automaticamente no RunQuest via webhook.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5">
            <a href="https://www.zepp.com/pt-br/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-rq-lime hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir app Zepp
            </a>
          </div>
        </div>

        {/* Strava */}
        <div className="glass p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold">Strava</h2>
              {strava?.connected
                ? <p className="text-sm text-rq-lime flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Conectado · athlete {strava.athleteId}</p>
                : <p className="text-sm text-white/60">Importe suas corridas automaticamente</p>}
            </div>
          </div>
          {strava?.connected
            ? <button onClick={disconnectStrava} className="btn-ghost text-sm py-2 px-4 w-full">Desconectar Strava</button>
            : <button onClick={connectStrava} className="btn-primary text-sm py-2 px-4 w-full">Conectar Strava</button>}
        </div>

        {/* BLE HR — qualquer cinta/relógio com o serviço padrão heart_rate */}
        <div className="glass p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-orange to-red-500 flex items-center justify-center shrink-0">
              <Heart className={`w-6 h-6 text-white ${hr.connected ? 'fill-white animate-pulse' : ''}`} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold">Frequência cardíaca (Bluetooth)</h2>
              {hr.connected
                ? <p className="text-sm text-rq-orange">Conectada · {hr.bpm ? `${hr.bpm} bpm` : 'aguardando dados…'}</p>
                : <p className="text-sm text-white/60">Polar H10, Wahoo TICKR, Garmin HRM, qualquer relógio/cinta BLE</p>}
            </div>
            {hr.connected && (
              <button onClick={hr.disconnect} className="text-white/30 hover:text-rq-orange text-xs shrink-0">Desconectar</button>
            )}
          </div>
          {hr.error && <p className="text-xs text-rq-orange mb-2">{hr.error}</p>}
          <button onClick={hr.connect} disabled={hr.connecting || hr.connected}
            className="btn-ghost text-sm py-2 px-4 w-full disabled:opacity-50 flex items-center justify-center gap-2">
            <Bluetooth className="w-4 h-4" />
            {hr.connected ? 'Conectada' : hr.connecting ? 'Conectando…' : 'Conectar via Bluetooth'}
          </button>
          <p className="text-xs text-white/40 mt-2 text-center">Funciona durante a corrida · Android Chrome · Samsung Browser</p>
        </div>

        {/* BLE Cadência/Velocidade — foot pod ou relógio com Running Speed & Cadence */}
        <div className="glass p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-emerald to-cyan-600 flex items-center justify-center shrink-0">
              <Footprints className={`w-6 h-6 text-white ${cad.connected ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold">Cadência / Foot Pod (Bluetooth)</h2>
              {cad.connected
                ? <p className="text-sm text-rq-emerald">
                    {cad.deviceName} · {cad.reading?.cadenceSpm ? `${cad.reading.cadenceSpm} spm` : 'aguardando dados…'}
                    {cad.reading?.speedMs != null ? ` · ${(cad.reading.speedMs * 3.6).toFixed(1)} km/h` : ''}
                  </p>
                : <p className="text-sm text-white/60">Stryd, foot pods e relógios com sensor de corrida BLE (Running Speed &amp; Cadence)</p>}
            </div>
            {cad.connected && (
              <button onClick={cad.disconnect} className="text-white/30 hover:text-rq-orange text-xs shrink-0">Desconectar</button>
            )}
          </div>
          {cad.error && <p className="text-xs text-rq-orange mb-2">{cad.error}</p>}
          <button onClick={cad.connect} disabled={cad.connecting || cad.connected}
            className="btn-ghost text-sm py-2 px-4 w-full disabled:opacity-50 flex items-center justify-center gap-2">
            <Bluetooth className="w-4 h-4" />
            {cad.connected ? 'Conectado' : cad.connecting ? 'Conectando…' : 'Conectar via Bluetooth'}
          </button>
        </div>

        {/* Celular GPS */}
        <div className="glass p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-lime to-rq-emerald flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-rq-ink" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold">GPS do celular</h2>
              <p className="text-sm text-white/60">Use o GPS nativo do seu smartphone durante a corrida</p>
            </div>
            <Link href="/app/run" className="btn-primary text-sm py-2 px-4 shrink-0">
              Correr agora
            </Link>
          </div>
        </div>

      </section>
    </main>
  );
}
