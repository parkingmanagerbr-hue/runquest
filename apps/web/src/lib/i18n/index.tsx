'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MESSAGES, type Lang, type MsgKey } from './messages';

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

export const DEFAULT_LANG: Lang = 'en';
const STORAGE_KEY = 'rq.lang';

const SUPPORTED = new Set<Lang>(LANGS.map((l) => l.code));

/** Resolve um BCP-47 / código de navegador para um idioma suportado. */
export function resolveLang(tag?: string | null): Lang {
  if (!tag) return DEFAULT_LANG;
  const t = tag.trim();
  if (SUPPORTED.has(t as Lang)) return t as Lang;
  const lower = t.toLowerCase();
  if (lower.startsWith('pt')) return 'pt-BR';
  if (lower.startsWith('zh')) return 'zh';
  const base = lower.split('-')[0];
  if (SUPPORTED.has(base as Lang)) return base as Lang;
  return DEFAULT_LANG;
}

export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return DEFAULT_LANG;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of langs) {
    const r = resolveLang(tag);
    if (r !== DEFAULT_LANG || tag?.toLowerCase().startsWith('en')) return r;
  }
  return resolveLang(langs[0]);
}

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Traduz uma chave para o idioma dado, com fallback EN e por fim a própria chave. */
export function translate(lang: Lang, key: MsgKey, vars?: Vars): string {
  const dict = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANG];
  const raw = dict[key] ?? MESSAGES[DEFAULT_LANG][key] ?? key;
  return interpolate(raw, vars);
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MsgKey, vars?: Vars) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const initial = saved && SUPPORTED.has(saved as Lang) ? (saved as Lang) : detectLang();
    setLangState(initial);
    if (typeof document !== 'undefined') document.documentElement.lang = initial;
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  };

  const value = useMemo<I18nCtx>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  // Fallback seguro fora do provider (ex.: render server inicial).
  return { lang: DEFAULT_LANG, setLang: () => {}, t: (key, vars) => translate(DEFAULT_LANG, key, vars) };
}

export type { Lang, MsgKey };
