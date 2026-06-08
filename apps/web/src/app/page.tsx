'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MapPinned, Target, Trophy, Sparkles, Brain, Coins, Zap, Shield, Smartphone,
  Headphones, LineChart, HeartPulse, Globe, Award, Download, ChevronRight,
} from 'lucide-react';
import { InstallPwaButton } from '@/components/InstallPwaButton';
import { LogoMark } from '@/components/LogoMark';
import { useI18n, LANGS, type MsgKey } from '@/lib/i18n';
import {
  PRICING, DEFAULT_CURRENCY, detectCurrency, pricingForCurrency,
  formatPrice, yearlySavingsPct, yearlyPerMonth,
} from '@/lib/pricing';

const features: { icon: typeof MapPinned; t: MsgKey; d: MsgKey }[] = [
  { icon: MapPinned, t: 'feat.territory.t', d: 'feat.territory.d' },
  { icon: Target, t: 'feat.missions.t', d: 'feat.missions.d' },
  { icon: Trophy, t: 'feat.xp.t', d: 'feat.xp.d' },
  { icon: Sparkles, t: 'feat.ranking.t', d: 'feat.ranking.d' },
  { icon: Brain, t: 'feat.ai.t', d: 'feat.ai.d' },
  { icon: Coins, t: 'feat.coins.t', d: 'feat.coins.d' },
  { icon: Zap, t: 'feat.offline.t', d: 'feat.offline.d' },
  { icon: Shield, t: 'feat.strava.t', d: 'feat.strava.d' },
];

const premium: { icon: typeof HeartPulse; t: MsgKey; d: MsgKey }[] = [
  { icon: HeartPulse, t: 'prem.trainer.t', d: 'prem.trainer.d' },
  { icon: LineChart, t: 'prem.stats.t', d: 'prem.stats.d' },
  { icon: Headphones, t: 'prem.personas.t', d: 'prem.personas.d' },
  { icon: Award, t: 'prem.exclusive.t', d: 'prem.exclusive.d' },
  { icon: Globe, t: 'prem.wearables.t', d: 'prem.wearables.d' },
  { icon: Shield, t: 'prem.noads.t', d: 'prem.noads.d' },
];

const FREE_KEYS: MsgKey[] = ['plan.free1', 'plan.free2', 'plan.free3', 'plan.free4', 'plan.free5', 'plan.free6'];
const MONTHLY_KEYS: MsgKey[] = ['plan.m1', 'plan.m2', 'plan.m3', 'plan.m4', 'plan.m5', 'plan.m6', 'plan.m7'];
const YEARLY_KEYS: MsgKey[] = ['plan.y1', 'plan.y2', 'plan.y3', 'plan.y4'];

export default function LandingPage() {
  const { t, lang, setLang } = useI18n();
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);

  useEffect(() => { setCurrency(detectCurrency()); }, []);

  const pricing = pricingForCurrency(currency);
  const freePrice = formatPrice(0, pricing);
  const monthlyPrice = formatPrice(pricing.monthly, pricing);
  const yearlyPrice = formatPrice(pricing.yearly, pricing);
  const yearlyPerMonthPrice = formatPrice(yearlyPerMonth(pricing), pricing);
  const savingsPct = yearlySavingsPct(pricing);
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-rq-aurora overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/60 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="w-9 h-9" />
            <span className="font-display text-lg tracking-tight">RunQuest</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <a href="#features" className="hover:text-white">{t('nav.features')}</a>
            <a href="#premium" className="hover:text-white">{t('nav.premium')}</a>
            <a href="#pricing" className="hover:text-white">{t('nav.pricing')}</a>
            <a href="#install" className="hover:text-white">{t('nav.install')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <select
              aria-label={t('common.language')}
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
              className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1 text-white/70 focus:outline-none focus:border-rq-lime/50">
              {LANGS.map((l) => (
                <option key={l.code} value={l.code} className="bg-rq-ink">{l.label}</option>
              ))}
            </select>
            <Link href="/auth/login" className="btn-ghost py-2 px-4 text-sm">{t('nav.login')}</Link>
            <Link href="/auth/register" className="btn-primary py-2 px-4 text-sm">{t('nav.startFree')}</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-20 pb-32 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rq-lime/30 bg-rq-lime/10 px-3 py-1 text-xs font-medium text-rq-lime mb-6">
              <Sparkles className="w-3.5 h-3.5" /> {t('hero.badge')}
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
              {t('hero.titlePre')} <span className="gradient-text">{t('hero.titleMid')}</span><br /> {t('hero.titlePost')}
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-xl">
              {t('hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <InstallPwaButton />
              <Link href="/auth/register" className="btn-ghost">
                {t('hero.createAccount')} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-6 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> {t('hero.worksAsApp')}</span>
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {t('hero.offlineFirst')}</span>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square flex items-center justify-center
                            rounded-3xl bg-black border border-rq-gold/20
                            shadow-[0_0_120px_rgba(255,193,7,0.18)]">
              <LogoMark className="w-full max-w-lg drop-shadow-[0_0_60px_rgba(255,193,7,0.5)]" />
            </div>
            <div className="absolute -bottom-4 -right-4 glass px-4 py-3 text-xs">
              <div className="text-rq-lime font-bold">+1.420 XP</div>
              <div className="text-white/60">{t('feat.missions.t')}</div>
            </div>
            <div className="absolute -top-4 -left-4 glass px-4 py-3 text-xs">
              <div className="text-rq-gold font-bold">12 hex</div>
              <div className="text-white/60">{t('feat.territory.t')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <div className="text-rq-lime text-sm font-semibold mb-2">{t('features.kicker')}</div>
            <h2 className="font-display text-4xl md:text-5xl font-black leading-tight">
              {t('features.heading')}
            </h2>
            <p className="mt-4 text-white/60 text-lg">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.t} className="glass p-6 hover:border-rq-lime/30 transition group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-lime/20 to-rq-violet/20 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <f.icon className="w-6 h-6 text-rq-lime" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{t(f.t)}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{t(f.d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREMIUM */}
      <section id="premium" className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-rq-violet/5 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className="max-w-2xl mb-16">
            <div className="text-rq-violet text-sm font-semibold mb-2 flex items-center gap-2">
              <HeartPulse className="w-4 h-4" /> {t('premiumSec.kicker')}
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-black leading-tight">
              {t('premiumSec.heading')}
            </h2>
            <p className="mt-4 text-white/60 text-lg">
              {t('premiumSec.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {premium.map((f) => (
              <div key={f.t} className="glass p-6 border-rq-violet/20 hover:border-rq-violet/50 transition">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rq-violet/40 to-rq-lime/20 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-rq-lime" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{t(f.t)}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{t(f.d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-rq-lime text-sm font-semibold">{t('pricingSec.kicker')}</span>
            <select
              aria-label={t('common.currency')}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-0.5 text-white/70 focus:outline-none focus:border-rq-lime/50">
              {Object.keys(PRICING).map((c) => (
                <option key={c} value={c} className="bg-rq-ink">{c}</option>
              ))}
            </select>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-black mb-4">{t('pricingSec.heading')}</h2>
          <p className="text-white/60 mb-12">{t('pricingSec.subtitle')}</p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass p-8 text-left">
              <div className="text-sm text-white/60 mb-2">{t('plan.freeLabel')}</div>
              <div className="font-display text-4xl font-black mb-4">{freePrice}</div>
              <p className="text-white/60 text-sm mb-6">{t('plan.freeDesc')}</p>
              <ul className="space-y-2 text-sm text-white/70">
                {FREE_KEYS.map((k) => <li key={k}>✓ {t(k)}</li>)}
              </ul>
            </div>
            <div className="glass p-8 text-left border-rq-lime/40 bg-gradient-to-br from-rq-violet/10 to-rq-lime/5 relative">
              <div className="absolute -top-3 left-8 bg-rq-lime text-rq-ink text-xs font-bold px-3 py-1 rounded-full">{t('plan.monthlyBadge')}</div>
              <div className="text-sm text-rq-lime mb-2">{t('plan.monthlyLabel')}</div>
              <div className="font-display text-4xl font-black mb-1">{monthlyPrice}<span className="text-base font-normal text-white/50">{t('plan.perMonthSuffix')}</span></div>
              <p className="text-white/60 text-sm mb-6">{t('plan.cancelAnytime')}</p>
              <ul className="space-y-2 text-sm text-white/70">
                {MONTHLY_KEYS.map((k) => <li key={k}>✓ {t(k)}</li>)}
              </ul>
            </div>
            <div className="glass p-8 text-left">
              <div className="text-sm text-white/60 mb-2">{t('plan.yearlyLabel')}</div>
              <div className="font-display text-4xl font-black mb-1">{yearlyPrice}<span className="text-base font-normal text-white/50">{t('plan.perYearSuffix')}</span></div>
              <p className="text-rq-gold text-sm mb-6">{t('plan.yearlySave', { pct: savingsPct, perMonth: yearlyPerMonthPrice })}</p>
              <ul className="space-y-2 text-sm text-white/70">
                {YEARLY_KEYS.map((k) => <li key={k}>✓ {t(k)}</li>)}
              </ul>
            </div>
          </div>
          <Link href="/pricing" className="btn-ghost inline-flex mt-8 text-sm">
            {t('plan.seePlans')} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* INSTALL */}
      <section id="install" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center glass p-12">
          <Download className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
          <h2 className="font-display text-4xl md:text-5xl font-black mb-4">{t('install.heading')}</h2>
          <p className="text-white/60 mb-8 max-w-2xl mx-auto">
            {t('install.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <InstallPwaButton />
            <a href="#" className="btn-ghost opacity-60 cursor-not-allowed">
              <Smartphone className="w-4 h-4" /> {t('install.androidSoon')}
            </a>
            <a href="#" className="btn-ghost opacity-60 cursor-not-allowed">
              <Smartphone className="w-4 h-4" /> {t('install.iosSoon')}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between text-sm text-white/40">
          <div className="flex items-center gap-3">
            <LogoMark className="w-8 h-8" />
            <span>{t('footer.rights', { year })}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/legal/privacy" className="hover:text-white">{t('footer.privacy')}</Link>
            <Link href="/legal/terms" className="hover:text-white">{t('footer.terms')}</Link>
            <a href="mailto:contato@runquest.veloxisit.com.br" className="hover:text-white">{t('footer.contact')}</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
