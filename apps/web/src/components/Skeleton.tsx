/**
 * Placeholders de carregamento. Antes toda tela mostrava um "Carregando…" nu
 * (centralizado, sem relação com o conteúdo) que causava layout shift quando os
 * dados chegavam. Estes skeletons desenham a forma do conteúdo que vem, na mesma
 * linguagem visual do app (animate-pulse + blocos translúcidos).
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/10 ${className}`} />;
}

/** Lista de "cards de linha" (histórico, missões, feed, ranking, metas…). */
export function SkeletonList({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass flex items-center gap-3 p-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.07]" />
          </div>
          <div className="h-3.5 w-10 shrink-0 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

/** Grade de cards (estatísticas, badges, loja…). */
export function SkeletonCards({ count = 6, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass p-4">
          <div className="mb-3 h-9 w-9 animate-pulse rounded-xl bg-white/10" />
          <div className="mb-2 h-3.5 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.07]" />
        </div>
      ))}
    </div>
  );
}
