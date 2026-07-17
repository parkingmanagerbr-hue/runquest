'use client';
import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

/** Botão de envio da corrida pro Strava — extraído do God component run/page.tsx. */
export function StravaUpload({ runId }: { runId: string }) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  const upload = async () => {
    setStatus('uploading');
    try {
      // NÃO migrar para o cliente `api`: aqui 401 significa "Strava não conectado"
      // (skip silencioso), não "sessão expirada". O api.request trataria o 401 como
      // token expirado e redirecionaria o usuário para o login.
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
