'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings as Cog, Save } from 'lucide-react';
import { tokens } from '@/lib/api';

interface Settings {
  displayName: string;
  weightKg?: number | null;
  heightCm?: number | null;
  birthDate?: string | null;
  units: string;
  audioCoachEnabled: boolean;
  audioCoachIntervalKm: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/settings`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    });
    const data = await r.json();
    setS(data);
    try { localStorage.setItem('rq.settings', JSON.stringify(data)); } catch {}
  };

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    load();
  }, [router]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
      body: JSON.stringify(s),
    });
    try { localStorage.setItem('rq.settings', JSON.stringify(s)); } catch {}
    setSaving(false);
    alert('Salvo ✓');
  };

  if (!s) return <main className="min-h-screen flex items-center justify-center text-white/60">Carregando…</main>;

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Configurações</h1>
          <button onClick={save} disabled={saving} className="ml-auto btn-primary text-sm py-2 px-4 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? '…' : 'Salvar'}
          </button>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="glass p-5 space-y-3">
          <h2 className="font-bold mb-3">Perfil</h2>
          <label className="block">
            <span className="text-xs text-white/60 uppercase tracking-wider">Nome</span>
            <input value={s.displayName} onChange={e => setS({ ...s, displayName: e.target.value })}
              className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-white/60 uppercase tracking-wider">Peso (kg)</span>
              <input type="number" min={30} max={300} step={0.5}
                value={s.weightKg ?? ''} onChange={e => setS({ ...s, weightKg: e.target.value ? Number(e.target.value) : null })}
                className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 tabular-nums" />
            </label>
            <label>
              <span className="text-xs text-white/60 uppercase tracking-wider">Altura (cm)</span>
              <input type="number" min={80} max={250}
                value={s.heightCm ?? ''} onChange={e => setS({ ...s, heightCm: e.target.value ? Number(e.target.value) : null })}
                className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 tabular-nums" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-white/60 uppercase tracking-wider">Data de nascimento</span>
            <input type="date" value={s.birthDate?.slice(0, 10) ?? ''}
              onChange={e => setS({ ...s, birthDate: e.target.value || null })}
              className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5" />
          </label>
        </div>

        <div className="glass p-5 space-y-3">
          <h2 className="font-bold mb-3">Unidades</h2>
          <div className="flex gap-2">
            {(['metric', 'imperial'] as const).map(u => (
              <button key={u} onClick={() => setS({ ...s, units: u })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${s.units === u ? 'bg-rq-lime text-rq-ink' : 'bg-white/5 text-white/60'}`}>
                {u === 'metric' ? 'Métrico (km, kg)' : 'Imperial (mi, lb)'}
              </button>
            ))}
          </div>
        </div>

        <div className="glass p-5 space-y-3">
          <h2 className="font-bold mb-3">Coach por voz</h2>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={s.audioCoachEnabled}
              onChange={e => setS({ ...s, audioCoachEnabled: e.target.checked })}
              className="w-5 h-5 accent-rq-lime" />
            <span>Ativar anúncios de voz durante a corrida</span>
          </label>
          {s.audioCoachEnabled && (
            <label className="block">
              <span className="text-xs text-white/60 uppercase tracking-wider">Anunciar a cada</span>
              <select value={s.audioCoachIntervalKm}
                onChange={e => setS({ ...s, audioCoachIntervalKm: Number(e.target.value) })}
                className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5">
                <option value={1} className="bg-rq-night">1 km</option>
                <option value={2} className="bg-rq-night">2 km</option>
                <option value={5} className="bg-rq-night">5 km</option>
              </select>
            </label>
          )}
        </div>
      </section>
    </main>
  );
}
