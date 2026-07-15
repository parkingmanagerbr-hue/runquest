'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogoMark } from '@/components/LogoMark';
import { formatDistance, formatDuration, formatPace, computeSplits } from '@/lib/geo';
import { estimateCalories } from '@/lib/calories';
import { Activity, Clock, TrendingUp, Flame, Share2, ExternalLink, Download, MapPin } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicRun {
  id: string;
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  startedAt: string;
  elevationGainM?: number;
  kcal?: number;
  pointsGeoJson?: { type: string; coordinates: [number, number][] };
  user: { displayName: string; avatarUrl: string | null; level: number };
}

// ─── SVG Route Map ────────────────────────────────────────────────────────────

function RouteMap({ coordinates }: { coordinates: [number, number][] }) {
  if (!coordinates || coordinates.length < 2) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white/5 rounded-xl">
        <MapPin className="w-8 h-8 text-white/20" />
        <span className="text-xs text-white/30">Sem dados de rota</span>
      </div>
    );
  }

  const W = 300;
  const H = 150;
  const PAD = 12;

  // coordinates are [lng, lat]
  const lngs = coordinates.map(c => c[0]);
  const lats = coordinates.map(c => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const lngRange = maxLng - minLng || 0.001;
  const latRange = maxLat - minLat || 0.001;

  const usableW = W - PAD * 2;
  const usableH = H - PAD * 2;
  const scale = Math.min(usableW / lngRange, usableH / latRange);
  const projW = lngRange * scale;
  const projH = latRange * scale;
  const offX = PAD + (usableW - projW) / 2;
  const offY = PAD + (usableH - projH) / 2;

  const toX = (lng: number) => offX + (lng - minLng) * scale;
  // SVG Y grows down; lat grows up — flip
  const toY = (lat: number) => offY + projH - (lat - minLat) * scale;

  // Sample up to 500 points for performance
  const step = Math.max(1, Math.floor(coordinates.length / 500));
  const sampled: [number, number][] = coordinates.filter((_, i) => i % step === 0);
  if (sampled[sampled.length - 1] !== coordinates[coordinates.length - 1]) {
    sampled.push(coordinates[coordinates.length - 1]);
  }

  const pathD = sampled
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${toX(c[0]).toFixed(1)},${toY(c[1]).toFixed(1)}`)
    .join(' ');

  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a3e635" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.9" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow shadow */}
      <path
        d={pathD}
        fill="none"
        stroke="#a3e635"
        strokeWidth="5"
        strokeOpacity="0.18"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
      />
      {/* Main route */}
      <path
        d={pathD}
        fill="none"
        stroke="url(#routeGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Start dot */}
      <circle
        cx={toX(start[0]).toFixed(1)}
        cy={toY(start[1]).toFixed(1)}
        r="5"
        fill="#a3e635"
        stroke="#0a0a1a"
        strokeWidth="1.5"
      />
      {/* End dot */}
      <circle
        cx={toX(end[0]).toFixed(1)}
        cy={toY(end[1]).toFixed(1)}
        r="5"
        fill="#7c3aed"
        stroke="#0a0a1a"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// ─── Splits Chart ─────────────────────────────────────────────────────────────

function SplitsChart({ splits }: { splits: { km: number; paceSecPerKm: number }[] }) {
  if (splits.length === 0) return null;

  const maxPace = Math.max(...splits.map(s => s.paceSecPerKm), 1);
  const minPace = Math.min(...splits.map(s => s.paceSecPerKm), 1);
  const paceRange = maxPace - minPace || 1;

  return (
    <div className="space-y-1.5">
      {splits.map(s => {
        const norm = paceRange > 0 ? 1 - (s.paceSecPerKm - minPace) / paceRange : 1;
        const widthPct = 40 + norm * 60;
        const isFastest = s.paceSecPerKm === minPace;
        const isSlowest = s.paceSecPerKm === maxPace;
        return (
          <div key={s.km} className="flex items-center gap-3">
            <div className="w-6 text-right font-mono text-white/40 text-xs">{s.km}</div>
            <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
              <div
                className={`h-full ${
                  isFastest
                    ? 'bg-gradient-to-r from-rq-lime to-emerald-400'
                    : isSlowest
                    ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                    : 'bg-gradient-to-r from-emerald-500/60 to-rq-lime/60'
                }`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <div className="w-14 text-right tabular-nums text-xs font-medium text-rq-lime">
              {formatPace(s.paceSecPerKm)}
            </div>
          </div>
        );
      })}
      <div className="flex justify-between pt-2 border-t border-white/5 text-xs text-white/30 mt-1">
        <span>🟢 {formatPace(minPace)}/km</span>
        <span>🟠 {formatPace(maxPace)}/km</span>
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ url, name, size = 52 }: { url: string | null; name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();

  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover border-2 border-rq-lime/30"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold border-2 border-rq-lime/30 bg-gradient-to-br from-rq-violet/60 to-rq-lime/20 text-white shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}
    >
      {initials || '?'}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-rq-aurora flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 animate-pulse">
        <div className="h-6 bg-white/10 rounded-lg w-32 mx-auto" />
        <div className="h-28 bg-white/5 rounded-2xl" />
        <div className="h-52 bg-white/5 rounded-2xl" />
        <div className="h-40 bg-white/5 rounded-2xl" />
        <div className="h-36 bg-white/5 rounded-2xl" />
      </div>
    </main>
  );
}

// ─── Not Found ────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <main className="min-h-screen bg-rq-aurora flex flex-col items-center justify-center gap-6 p-6 text-center">
      <LogoMark className="w-16 h-16 opacity-60" />
      <div>
        <h1 className="font-display text-2xl font-black mb-2">Corrida não encontrada</h1>
        <p className="text-white/50 text-sm max-w-xs">
          Este link pode ter expirado, ou a corrida não foi compartilhada publicamente.
        </p>
      </div>
      <Link href="/" className="btn-primary">
        Conhecer o RunQuest
      </Link>
    </main>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicRunSharePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [run, setRun] = useState<PublicRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect session via localStorage (client-only)
  useEffect(() => {
    try {
      setIsLoggedIn(!!localStorage.getItem('rq.at'));
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  // Fetch public run — no auth header
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api';
    fetch(`${apiBase}/runs/public/${id}`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); return; }
        const data: PublicRun = await r.json();
        setRun(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = useCallback(async () => {
    if (!run) return;
    const text = `Corri ${formatDistance(run.distanceMeters)} km em ${formatDuration(run.durationSec)} (${formatPace(run.avgPaceSecPerKm)}/km) 🏃 RunQuest`;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'Minha corrida no RunQuest', text, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {}
    }
  }, [run]);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !run) return <NotFound />;

  // Build splits from GPS coords or fall back to uniform average pace
  const splits = (() => {
    const raw = computeSplits(run.pointsGeoJson?.coordinates ?? [], run.durationSec);
    if (raw.length > 0) return raw;
    const totalKm = Math.floor(run.distanceMeters / 1000);
    if (totalKm < 1) return [];
    return Array.from({ length: totalKm }, (_, i) => ({
      km: i + 1,
      paceSecPerKm: run.avgPaceSecPerKm,
    }));
  })();

  const date = new Date(run.startedAt);
  const dateStr = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const kcal = run.kcal ?? estimateCalories(run.distanceMeters);
  const coords = run.pointsGeoJson?.coordinates ?? [];

  // CTA: if logged in, go straight to the authenticated run detail; else prompt login
  const ctaHref = isLoggedIn ? `/app/runs/${id}` : '/auth/login';
  const ctaLabel = isLoggedIn ? 'Ver no app' : 'Entrar no app';

  return (
    <main className="min-h-screen bg-rq-aurora flex flex-col items-center px-4 py-8 gap-5">

      {/* ── Logo bar ── */}
      <header className="w-full max-w-sm flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LogoMark className="w-8 h-8" />
          <span className="font-display font-bold text-lg tracking-tight">RunQuest</span>
        </Link>
        <button
          onClick={handleShare}
          className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
          aria-label="Compartilhar corrida"
        >
          <Share2 className="w-3.5 h-3.5" />
          {copied ? 'Copiado! ✓' : 'Compartilhar'}
        </button>
      </header>

      {/* ── Card: Runner ── */}
      <div className="w-full max-w-sm glass rounded-2xl p-5 flex items-center gap-4">
        <UserAvatar url={run.user.avatarUrl} name={run.user.displayName} size={52} />
        <div className="flex-1 min-w-0">
          <div className="font-display font-black text-lg leading-tight truncate">
            {run.user.displayName}
          </div>
          <div className="text-xs text-white/50 mt-0.5 capitalize">{dateStr}</div>
        </div>
        {run.user.level > 0 && (
          <div className="flex flex-col items-center shrink-0">
            <div className="text-rq-lime font-black font-display text-xl leading-none">
              {run.user.level}
            </div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">nível</div>
          </div>
        )}
      </div>

      {/* ── Card: Hero distance + stats ── */}
      <div className="w-full max-w-sm glass rounded-2xl p-6 relative overflow-hidden">
        {/* Ambient glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-rq-lime/5 via-transparent to-rq-violet/10 pointer-events-none rounded-2xl" />

        <div className="relative">
          <div className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-1">
            Distância
          </div>
          <div className="flex items-end gap-2 mb-5">
            <span className="font-display font-black text-[72px] leading-none text-rq-lime tabular-nums">
              {formatDistance(run.distanceMeters)}
            </span>
            <span className="font-display font-bold text-2xl text-rq-lime/50 mb-2">km</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
            <div>
              <div className="flex items-center gap-1 text-white/40 mb-1">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wide">Pace</span>
              </div>
              <div className="font-display font-bold tabular-nums text-base">
                {formatPace(run.avgPaceSecPerKm)}
              </div>
              <div className="text-[10px] text-white/30">/km</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-white/40 mb-1">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wide">Tempo</span>
              </div>
              <div className="font-display font-bold tabular-nums text-base">
                {formatDuration(run.durationSec)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-white/40 mb-1">
                <Flame className="w-3 h-3 text-orange-400" />
                <span className="text-[10px] uppercase tracking-wide">Kcal</span>
              </div>
              <div className="font-display font-bold tabular-nums text-base">{kcal}</div>
            </div>
          </div>

          {/* Elevation — only if available */}
          {run.elevationGainM && run.elevationGainM > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-white/40">
              <Activity className="w-3 h-3" />
              <span>+{Math.round(run.elevationGainM)} m de elevação</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Card: Route map ── */}
      <div className="w-full max-w-sm glass rounded-2xl p-4">
        <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">
          Rota
        </div>
        <div className="w-full h-[150px] rounded-xl overflow-hidden bg-rq-ink/40">
          <RouteMap coordinates={coords} />
        </div>
        {coords.length >= 2 && (
          <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-rq-lime" />
              Início
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-rq-violet" />
              Fim
            </span>
          </div>
        )}
      </div>

      {/* ── Card: Splits ── */}
      {splits.length > 0 && (
        <div className="w-full max-w-sm glass rounded-2xl p-5">
          <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-4">
            Splits por km
          </div>
          <SplitsChart splits={splits} />
        </div>
      )}

      {/* ── Footer card ── */}
      <div className="w-full max-w-sm glass rounded-2xl p-5 text-center border-rq-lime/10">
        <div className="text-sm text-white/60 font-medium">Corrido com RunQuest 🏃</div>
        <div className="text-xs text-white/30 mt-1.5 leading-relaxed">
          Escaneie o QR code ou acesse{' '}
          <span className="text-rq-lime/70">runquest.app</span>{' '}
          para transformar cada corrida em uma aventura
        </div>
      </div>

      {/* ── CTA buttons ── */}
      <div className="w-full max-w-sm flex flex-col gap-3 pb-6">
        <Link
          href={ctaHref}
          className="btn-primary w-full text-center flex items-center justify-center gap-2 py-3 text-sm font-semibold"
        >
          <ExternalLink className="w-4 h-4" />
          {ctaLabel}
        </Link>
        <Link
          href="/"
          className="btn-ghost w-full text-center flex items-center justify-center gap-2 py-3 text-sm"
        >
          <Download className="w-4 h-4" />
          Baixar RunQuest
        </Link>
      </div>

      <footer className="text-xs text-white/20 text-center pb-2">
        © {new Date().getFullYear()} RunQuest · Gamify your run
      </footer>
    </main>
  );
}
