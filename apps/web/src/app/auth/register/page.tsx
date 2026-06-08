'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, tokens } from '@/lib/api';
import { LogoMark } from '@/components/LogoMark';
import { useI18n } from '@/lib/i18n';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/auth/google/available`)
      .then(r => r.json()).then(r => setGoogleOn(!!r.available)).catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const r = await api.register(form);
      tokens.save(r.accessToken, r.refreshToken);
      router.push('/app');
    } catch (e: any) {
      setErr(e.message ?? t('auth.register.error'));
    } finally { setLoading(false); }
  };

  const googleLogin = () => {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/auth/google`;
    window.location.href = url;
  };

  return (
    <main className="min-h-screen bg-rq-aurora flex items-center justify-center px-6 py-12">
      <div className="glass p-8 w-full max-w-md">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <LogoMark className="w-10 h-10" />
          <span className="font-display text-xl">RunQuest</span>
        </Link>
        <h1 className="font-display text-3xl font-black mb-2">{t('auth.register.title')}</h1>
        <p className="text-white/60 text-sm mb-6">{t('auth.register.subtitle')}</p>

        {googleOn && (
          <>
            <button onClick={googleLogin} className="btn-ghost w-full mb-4">
              <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.9-4.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5c-7.7 0-14.4 4.4-17.7 10.2z"/><path fill="#4CAF50" d="M24 45.5c5.4 0 10.3-2 14-5.4l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.1 0-9.5-3.3-11.2-8l-6.5 5C9.4 41 16.1 45.5 24 45.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.5 5.5C41.2 36.5 44.5 30.7 44.5 25c0-1.5-.2-3-.9-4.5z"/></svg>
              {t('auth.register.google')}
            </button>
            <div className="flex items-center gap-3 my-4 text-xs text-white/40">
              <div className="flex-1 h-px bg-white/10" /> {t('auth.common.or')} <div className="flex-1 h-px bg-white/10" />
            </div>
          </>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            required minLength={2} maxLength={60}
            value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder={t('auth.field.name')}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:border-rq-lime/50 outline-none"
          />
          <input
            type="email" required
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder={t('auth.field.email')}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:border-rq-lime/50 outline-none"
          />
          <input
            type="password" required minLength={8}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={t('auth.field.passwordMin')}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:border-rq-lime/50 outline-none"
          />
          {err && <div className="text-rq-orange text-sm">{err}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? t('auth.register.loading') : t('auth.register.submit')}
          </button>
        </form>

        <div className="mt-6 text-sm text-white/60 text-center">
          {t('auth.register.hasAccount')} <Link href="/auth/login" className="text-rq-lime hover:underline">{t('auth.login.submit')}</Link>
        </div>
      </div>
    </main>
  );
}
