'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Crown, Sparkles, Bot, Palette, TrendingUp, Shield } from 'lucide-react';
import { api, tokens, ApiError } from '@/lib/api';
import {
  PRICING, DEFAULT_CURRENCY, detectCurrency, pricingForCurrency,
  formatPrice, yearlySavingsPct, yearlyPerMonth, type CurrencyPricing,
} from '@/lib/pricing';
import { useI18n, LANGS, type MsgKey } from '@/lib/i18n';
import { Skeleton } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';

type Plan = 'MONTHLY' | 'YEARLY';

const BENEFITS: { icon: typeof Bot; key: MsgKey }[] = [
  { icon: Bot, key: 'benefit.trainer' },
  { icon: Sparkles, key: 'benefit.coach' },
  { icon: Palette, key: 'benefit.skins' },
  { icon: TrendingUp, key: 'benefit.analytics' },
  { icon: Shield, key: 'benefit.noads' },
];

export default function PricingPage() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [plan, setPlan] = useState<Plan>('YEARLY');
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCurrency(detectCurrency());
    const hasSession = tokens.hasSession();
    setLoggedIn(hasSession);
    if (!hasSession) { setIsPremium(false); return; }
    api.me()
      .then(u => { setIsPremium(u.isPremium || !!u.isOwner); setPremiumUntil(u.premiumUntil ?? null); })
      .catch(() => setIsPremium(false));
  }, []);

  const subscribe = async () => {
    haptic();
    if (!loggedIn) { router.push('/auth/login?next=/pricing'); return; }
    setBusy(true); setError('');
    try {
      // Envia idioma da UI p/ o gateway traduzir a tela de pagamento.
      const { initPoint } = await api.checkout(plan, currency, lang);
      window.location.href = initPoint;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t('pricing.checkoutError');
      setError(msg);
      setBusy(false);
    }
  };

  const pricing: CurrencyPricing = pricingForCurrency(currency);
  const monthlyPrice = formatPrice(pricing.monthly, pricing);
  const yearlyPrice = formatPrice(pricing.yearly, pricing);
  const yearlyPerMonthPrice = formatPrice(yearlyPerMonth(pricing), pricing);
  const savingsPct = yearlySavingsPct(pricing);
  const gatewayLabel = pricing.provider === 'mercadopago' ? 'Mercado Pago' : 'Stripe';

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={loggedIn ? '/app' : '/'} className="text-white/70" aria-label={t('common.back')}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-rq-gold" />
            <h1 className="font-display font-bold">{t('pricing.premiumTitle')}</h1>
          </div>
          <select
            aria-label={t('common.language')}
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="ml-auto bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 text-white/70 focus:outline-none focus:border-rq-lime/50">
            {LANGS.map((l) => (
              <option key={l.code} value={l.code} className="bg-rq-ink">{l.label}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Enquanto api.me() carrega, isPremium é null. Sem este ramo, um usuário
            já Premium via primeiro o bloco "Assinar" e só depois ele trocava
            pelo card "Você já é Premium" — flash de conteúdo errado. */}
        {isPremium === null && (
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="mx-auto h-7 w-2/3" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        )}

        {isPremium === true && (
          <div className="glass p-6 border-rq-lime/40 bg-gradient-to-br from-rq-lime/10 to-transparent text-center">
            <Crown className="w-10 h-10 mx-auto mb-3 text-rq-gold" />
            <h2 className="font-bold text-lg mb-1">{t('pricing.alreadyTitle')}</h2>
            <p className="text-white/60 text-sm">
              {premiumUntil
                ? t('pricing.alreadyValidUntil', { date: new Date(premiumUntil).toLocaleDateString(lang) })
                : t('pricing.alreadyEnjoy')}
            </p>
            <Link href="/app/ai-trainer" className="btn-primary inline-flex text-sm py-2 px-6 mt-4">
              {t('pricing.goToTrainer')}
            </Link>
          </div>
        )}

        {isPremium === false && (
          <>
            <div className="text-center space-y-2">
              <h2 className="font-display text-2xl font-bold">{t('pricing.heading')}</h2>
              <p className="text-white/60 text-sm">{t('pricing.subheading')}</p>
            </div>

            {/* Seletor de moeda */}
            <div className="flex items-center justify-center gap-2">
              <label htmlFor="currency" className="text-xs text-white/40">{t('common.currency')}</label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg text-sm px-2 py-1 text-white/80 focus:outline-none focus:border-rq-lime/50">
                {Object.keys(PRICING).map((c) => (
                  <option key={c} value={c} className="bg-rq-ink">{c}</option>
                ))}
              </select>
            </div>

            {/* Toggle de plano */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPlan('MONTHLY')}
                className={`p-4 rounded-2xl border text-left transition ${plan === 'MONTHLY' ? 'bg-rq-lime/15 border-rq-lime/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                <div className="text-xs text-white/50 uppercase tracking-wider">{t('pricing.monthly')}</div>
                <div className="font-display text-2xl font-bold mt-1">{monthlyPrice}</div>
                <div className="text-xs text-white/50">{t('pricing.perMonth')}</div>
              </button>
              <button
                onClick={() => setPlan('YEARLY')}
                className={`relative p-4 rounded-2xl border text-left transition ${plan === 'YEARLY' ? 'bg-rq-lime/15 border-rq-lime/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                {savingsPct > 0 && (
                  <span className="absolute -top-2 right-3 text-[10px] bg-rq-gold text-black font-bold px-2 py-0.5 rounded-full">
                    {t('pricing.save', { pct: savingsPct })}
                  </span>
                )}
                <div className="text-xs text-white/50 uppercase tracking-wider">{t('pricing.yearly')}</div>
                <div className="font-display text-2xl font-bold mt-1">{yearlyPrice}</div>
                <div className="text-xs text-white/50">{t('pricing.perMonthYear', { price: yearlyPerMonthPrice })}</div>
              </button>
            </div>

            {/* Benefícios */}
            <div className="glass p-5 space-y-3">
              {BENEFITS.map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rq-lime/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-rq-lime" />
                  </div>
                  <span className="text-sm">{t(key)}</span>
                  <Check className="w-4 h-4 text-rq-lime ml-auto shrink-0" />
                </div>
              ))}
            </div>

            {error && <div className="glass p-3 border-rq-orange/40 text-rq-orange text-sm">{error}</div>}

            <button onClick={subscribe} disabled={busy}
              className="btn-primary w-full py-4 text-base disabled:opacity-50 flex items-center justify-center gap-2">
              <Crown className="w-5 h-5" />
              {busy ? t('pricing.opening') : t(plan === 'YEARLY' ? 'pricing.subscribeYearly' : 'pricing.subscribeMonthly')}
            </button>

            <p className="text-center text-xs text-white/40">
              {t('pricing.securePayment', { gateway: gatewayLabel })} {!loggedIn && t('common.loginRequired')}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
