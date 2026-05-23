'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/api';

export default function GoogleCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const at = params.get('at'); const rt = params.get('rt');
    if (at && rt) {
      tokens.save(at, rt);
      router.replace('/app');
    } else {
      router.replace('/auth/login?error=oauth');
    }
  }, [router]);
  return <main className="min-h-screen flex items-center justify-center text-white/60">Conectando…</main>;
}
