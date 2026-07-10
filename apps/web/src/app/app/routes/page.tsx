'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Route as RouteIcon, Undo2, Trash2, Repeat, CircleDot, Save, Play } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatPace, formatDuration, formatDistance } from '@/lib/geo';
import {
  routeStats, outAndBack, closeLoop, loadRoutes, saveRoute, deleteRoute,
  type LatLng, type SavedRoute,
} from '@/lib/routePlanner';
import { estimatePaces, type RunLite } from '@/lib/trainingPaces';

const RouteDrawMap = dynamic(() => import('@/components/RouteDrawMap').then((m) => m.RouteDrawMap), {
  ssr: false,
  loading: () => <div className="h-[52vh] bg-rq-night animate-pulse rounded-2xl" />,
});

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export default function RoutesPage() {
  const router = useRouter();
  const [points, setPoints] = useState<LatLng[]>([]);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [runs, setRuns] = useState<RunLite[]>([]);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    setSaved(loadRoutes());
    fetch(`${API}/runs?limit=100`, { headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const arr: RunLite[] = Array.isArray(d) ? d : (d?.items ?? []);
        setRuns(arr.map((r) => ({ distanceMeters: r.distanceMeters, durationSec: r.durationSec, startedAt: r.startedAt })));
      })
      .catch(() => {});
  }, [router]);

  // Pace fácil do usuário (das corridas reais) p/ estimar o tempo do percurso
  const easyPace = useMemo(() => {
    const p = estimatePaces(runs, Date.now());
    return p.paces.easy;
  }, [runs]);

  const stats = useMemo(() => routeStats(points, easyPace), [points, easyPace]);

  const save = () => {
    if (points.length < 2) return;
    saveRoute(name || `Percurso ${formatDistance(stats.distanceM)} km`, points);
    setSaved(loadRoutes());
    setName('');
  };

  const remove = (id: string) => { deleteRoute(id); setSaved(loadRoutes()); };

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold flex items-center gap-2">
            <RouteIcon className="w-4 h-4 text-rq-lime" /> Planejar Percurso
          </h1>
          <div className="ml-auto text-sm text-white/60 tabular-nums">
            {formatDistance(stats.distanceM)} km{stats.estSec > 0 ? ` · ~${formatDuration(stats.estSec)}` : ''}
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="glass p-3 text-xs text-white/50">
          Toque no mapa para desenhar seu percurso ponto a ponto — como no Google Maps. A prévia mostra
          distância real e tempo estimado <strong className="text-white/80">no seu pace fácil ({formatPace(easyPace)}/km)</strong>.
        </div>

        <RouteDrawMap points={points} onAdd={(p) => setPoints((ps) => [...ps, p])} />

        {/* Ferramentas de desenho */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPoints((ps) => ps.slice(0, -1))} disabled={points.length === 0}
            className="btn-ghost text-xs py-2 px-3 disabled:opacity-40"><Undo2 className="w-3.5 h-3.5" /> Desfazer</button>
          <button onClick={() => setPoints(outAndBack(points))} disabled={points.length < 2}
            className="btn-ghost text-xs py-2 px-3 disabled:opacity-40"><Repeat className="w-3.5 h-3.5" /> Ida e volta</button>
          <button onClick={() => setPoints(closeLoop(points))} disabled={points.length < 3}
            className="btn-ghost text-xs py-2 px-3 disabled:opacity-40"><CircleDot className="w-3.5 h-3.5" /> Fechar circuito</button>
          <button onClick={() => setPoints([])} disabled={points.length === 0}
            className="btn-ghost text-xs py-2 px-3 disabled:opacity-40 text-rq-orange border-rq-orange/30"><Trash2 className="w-3.5 h-3.5" /> Limpar</button>
        </div>

        {/* Prévia + salvar */}
        {points.length >= 2 && (
          <div className="glass p-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <div className="text-[11px] text-white/40 uppercase">Distância</div>
                <div className="font-display text-2xl font-black tabular-nums">{formatDistance(stats.distanceM)}<span className="text-sm text-white/40 font-normal"> km</span></div>
              </div>
              <div>
                <div className="text-[11px] text-white/40 uppercase">Tempo est.</div>
                <div className="font-display text-2xl font-black tabular-nums">{stats.estSec > 0 ? formatDuration(stats.estSec) : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] text-white/40 uppercase">Pontos</div>
                <div className="font-display text-2xl font-black tabular-nums">{stats.points}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do percurso (ex.: Volta do parque)"
                className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:border-rq-lime/50 outline-none" />
              <button onClick={save} className="btn-primary text-sm py-2 px-4"><Save className="w-4 h-4" /> Salvar</button>
            </div>
          </div>
        )}

        {/* Percursos salvos */}
        {saved.length > 0 && (
          <div className="glass p-4">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/50 mb-3">Meus percursos</h2>
            <div className="space-y-2">
              {saved.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{r.name}</div>
                    <div className="text-[11px] text-white/40 tabular-nums">
                      {formatDistance(r.distanceM)} km · ~{formatDuration(Math.round((r.distanceM / 1000) * easyPace))} no fácil
                    </div>
                  </div>
                  <button onClick={() => setPoints(r.points)} className="btn-ghost text-xs py-1.5 px-3">Carregar</button>
                  <Link href="/app/run" className="btn-ghost text-xs py-1.5 px-3 text-rq-lime border-rq-lime/30">
                    <Play className="w-3 h-3" /> Correr
                  </Link>
                  <button onClick={() => remove(r.id)} className="text-white/30 hover:text-rq-orange"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
