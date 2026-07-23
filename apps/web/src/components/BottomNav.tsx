'use client';
import Link from 'next/link';
import { NAV_ITEMS, isActive } from '@/lib/nav';

/**
 * Barra de navegação inferior persistente (padrão de app mobile: Strava, Nike
 * Run, Adidas). Antes, a única forma de sair de uma feature era o back-arrow
 * voltando ao dashboard e escolher de novo — hub-and-spoke com 21 cards. Isto dá
 * movimento lateral direto entre as 5 áreas mais usadas em qualquer tela.
 * A lógica de estado (ativo/imersivo) vive em @/lib/nav (pura, testada).
 */
export function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-rq-ink/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          if (item.primary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="relative -mt-5 flex w-16 shrink-0 flex-col items-center justify-start gap-1"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rq-lime to-rq-emerald text-rq-ink shadow-lg shadow-rq-lime/30 ring-4 ring-rq-ink transition active:scale-95">
                  <Icon className="h-6 w-6" fill="currentColor" />
                </span>
                <span className="text-[10px] font-bold text-rq-lime">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition ${
                active ? 'text-rq-lime' : 'text-white/45 hover:text-white/80'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
