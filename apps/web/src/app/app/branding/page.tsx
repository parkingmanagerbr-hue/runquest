'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/api';

export default function BrandingPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens.hasSession()) router.replace('/auth/login');
  }, [router]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setPreview(data);
      // Persiste em localStorage para uso imediato no app (cliente). Para o backend:
      // POST /api/users/me/avatar (a implementar)
      localStorage.setItem('rq.userLogo', data);
      setInfo(`Logo salvo localmente (${Math.round(f.size / 1024)} KB). Use o painel admin no backend p/ aplicar globalmente.`);
    };
    reader.readAsDataURL(f);
  };

  return (
    <main className="min-h-screen bg-rq-aurora p-8 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl font-black mb-2">Logo do RunQuest</h1>
      <p className="text-white/60 mb-6">
        Upload de um PNG/SVG para usar como logo pessoal (cliente).
        Versão definitiva (global) precisa ser deployada via repo.
      </p>
      <input
        type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp"
        onChange={onFile}
        className="block w-full text-sm text-white/80 file:mr-4 file:px-4 file:py-2 file:rounded-xl
                   file:border-0 file:bg-rq-lime file:text-rq-ink file:font-semibold"
      />
      {info && <p className="mt-4 text-sm text-rq-lime">{info}</p>}
      {preview && (
        <div className="mt-8 glass p-6">
          <h2 className="font-bold mb-3">Preview</h2>
          {/* next/image não serve p/ preview de blob/data URL local sem dimensões — img é o certo aqui */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="logo" className="max-w-xs rounded-2xl" />
        </div>
      )}
    </main>
  );
}
