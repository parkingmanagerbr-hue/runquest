import { Home, Play, Trophy, Medal, User, type LucideIcon } from 'lucide-react';

/**
 * Modelo puro da navegação principal — sem React/next, para ser testável em
 * isolamento. A BottomNav (componente) só renderiza o que está aqui.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Início', icon: Home },
  { href: '/app/missions', label: 'Missões', icon: Trophy },
  { href: '/app/run', label: 'Correr', icon: Play, primary: true },
  { href: '/app/leaderboard', label: 'Ranking', icon: Medal },
  { href: '/app/profile', label: 'Perfil', icon: User },
];

/**
 * Telas imersivas (GPS ao vivo, execução de treino) ocupam a tela inteira e a
 * barra atrapalharia — some nelas.
 */
export function isImmersive(pathname: string): boolean {
  return pathname === '/app/run' || pathname.endsWith('/play');
}

/**
 * `/app` é prefixo de todas as rotas, então só marca "Início" no match exato.
 * Nas demais, marca no match exato ou como prefixo de sub-rota (ex.: /app/runs).
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(href + '/');
}
