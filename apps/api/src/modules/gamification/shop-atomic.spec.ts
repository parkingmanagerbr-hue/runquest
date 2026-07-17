import { ShopController } from './gamification.module';

/**
 * Prova do bug de economia da loja (mesma classe do BUG-5, mas no `buy`):
 * a checagem "tem moedas?" acontecia FORA da transação, então dois requests
 * concorrentes comprando itens DIFERENTES liam o mesmo saldo, ambos passavam,
 * e ambos decrementavam — saldo negativo e 2 itens pelo preço de 1.
 *
 * O Prisma falso é STATEFUL e modela a garantia do banco: o `updateMany` com
 * `runCoins: { gte: preço }` no WHERE só desconta se o saldo AINDA cobrir.
 */
function makeFakePrisma(startCoins: number, items: Record<string, { id: string; price: number; premiumOnly?: boolean }>) {
  const state = { coins: startCoins, owned: new Set<string>() };

  const fake: any = {
    cosmeticItem: {
      findUnique: async ({ where }: any) => items[where.id] ?? null,
    },
    userItem: {
      // Leitura OBSOLETA: ambos os requests veem "não possui".
      findUnique: async () => null,
      create: async ({ data }: any) => {
        if (state.owned.has(data.itemId)) throw new Error('unique violation');
        state.owned.add(data.itemId);
        return data;
      },
    },
    user: {
      // Leitura OBSOLETA: ambos veem o saldo inicial.
      findUnique: async () => ({ runCoins: startCoins, isPremium: false }),
      // Decremento SEM guarda — é o que o banco faz num `update` cru: aceita
      // levar o saldo a negativo. (Com o código antigo, o teste abaixo pega -100.)
      update: async ({ data }: any) => {
        state.coins -= data.runCoins.decrement;
        return {};
      },
      // Decremento GUARDADO: só desconta se o saldo AINDA cobrir o preço.
      updateMany: async ({ where, data }: any) => {
        const min = where.runCoins?.gte ?? 0;
        if (state.coins < min) return { count: 0 };
        state.coins -= data.runCoins.decrement;
        return { count: 1 };
      },
    },
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg(fake) : Promise.all(arg)),
  };
  return { fake, state };
}

describe('ShopController.buy — atomicidade do saldo', () => {
  const user = { id: 'u1' } as any;
  const items = {
    a: { id: 'a', price: 100 },
    b: { id: 'b', price: 100 },
  };

  it('duas compras concorrentes com saldo p/ UMA: só uma passa, saldo nunca fica negativo', async () => {
    const { fake, state } = makeFakePrisma(100, items); // 100 moedas, 2 itens de 100
    const ctrl = new ShopController(fake);

    const [r1, r2] = await Promise.all([ctrl.buy(user, 'a'), ctrl.buy(user, 'b')]);

    const oks = [r1, r2].filter((r: any) => r.ok);
    expect(oks).toHaveLength(1); // só uma compra
    expect([r1, r2].filter((r: any) => r.error === 'NOT_ENOUGH_COINS')).toHaveLength(1);
    expect(state.coins).toBe(0); // NUNCA negativo
    expect(state.owned.size).toBe(1); // 1 item, não 2
  });

  it('compra válida desconta o preço e entrega o item', async () => {
    const { fake, state } = makeFakePrisma(250, items);
    const ctrl = new ShopController(fake);
    const r: any = await ctrl.buy(user, 'a');
    expect(r.ok).toBe(true);
    expect(state.coins).toBe(150);
    expect(state.owned.has('a')).toBe(true);
  });

  it('saldo insuficiente não desconta nada', async () => {
    const { fake, state } = makeFakePrisma(50, items);
    const ctrl = new ShopController(fake);
    const r: any = await ctrl.buy(user, 'a');
    expect(r.error).toBe('NOT_ENOUGH_COINS');
    expect(state.coins).toBe(50);
    expect(state.owned.size).toBe(0);
  });

  it('item inexistente → NOT_FOUND', async () => {
    const { fake } = makeFakePrisma(500, items);
    const ctrl = new ShopController(fake);
    expect((await ctrl.buy(user, 'nao-existe') as any).error).toBe('NOT_FOUND');
  });
});
