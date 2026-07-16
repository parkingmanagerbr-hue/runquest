/**
 * Montagem PURA de um item do feed a partir da linha do Prisma. Extraída para
 * travar o BUG-4: `commentsCount` vinha de `comments.length`, mas a lista de
 * comentários é buscada com `take: 3` (só o preview) — então uma corrida com 10
 * comentários exibia "3". O total real tem que vir de `_count.comments`.
 */

export interface FeedRunRow {
  kudos: { userId: string }[];
  comments: unknown[]; // preview (take: 3)
  _count: { comments: number };
  [key: string]: unknown;
}

export interface FeedRunView {
  kudosCount: number;
  youKudoed: boolean;
  commentsCount: number;
  comments: unknown[];
  [key: string]: unknown;
}

/** Converte a linha crua do feed no DTO exposto ao cliente. */
export function shapeFeedRun(row: FeedRunRow, viewerId: string): FeedRunView {
  const { kudos, _count, ...rest } = row;
  return {
    ...rest,
    kudosCount: kudos.length,
    youKudoed: kudos.some((k) => k.userId === viewerId),
    // Total REAL — nunca o tamanho do preview (take: 3).
    commentsCount: _count.comments,
  } as FeedRunView;
}
