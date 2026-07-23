import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * Estado vazio consistente. Antes cada tela improvisava o seu (ou não tinha —
 * listas vazias mostravam um cabeçalho solto sobre o nada). Centraliza ícone +
 * título + texto + CTA opcional na linguagem visual do app (card glass).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={`glass p-10 text-center ${className}`}>
      <Icon className="mx-auto mb-4 h-10 w-10 text-rq-lime" />
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/55">{description}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-5 inline-flex px-5 py-2.5 text-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}
