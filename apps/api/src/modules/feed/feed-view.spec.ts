import { shapeFeedRun, FeedRunRow } from './feed-view';

const row = (over: Partial<FeedRunRow> = {}): FeedRunRow => ({
  id: 'run1',
  kudos: [],
  comments: [],
  _count: { comments: 0 },
  ...over,
});

describe('shapeFeedRun', () => {
  it('BUG-4: commentsCount vem de _count, NÃO do preview limitado (take:3)', () => {
    const r = shapeFeedRun(
      row({ comments: [{}, {}, {}], _count: { comments: 10 } }), // preview 3, total 10
      'viewer',
    );
    expect(r.commentsCount).toBe(10); // total real, não 3
    expect(r.comments).toHaveLength(3); // preview preservado
  });

  it('kudosCount = tamanho da lista de kudos', () => {
    const r = shapeFeedRun(row({ kudos: [{ userId: 'a' }, { userId: 'b' }] }), 'viewer');
    expect(r.kudosCount).toBe(2);
  });

  it('youKudoed reflete se o viewer curtiu', () => {
    expect(shapeFeedRun(row({ kudos: [{ userId: 'viewer' }] }), 'viewer').youKudoed).toBe(true);
    expect(shapeFeedRun(row({ kudos: [{ userId: 'outro' }] }), 'viewer').youKudoed).toBe(false);
  });

  it('preserva os demais campos e não vaza _count', () => {
    const r = shapeFeedRun(row({ id: 'runX', distanceMeters: 5000 } as any), 'viewer');
    expect(r.id).toBe('runX');
    expect((r as any).distanceMeters).toBe(5000);
    expect((r as any)._count).toBeUndefined();
  });
});
