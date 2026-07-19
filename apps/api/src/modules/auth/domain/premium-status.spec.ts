import { UserAccount } from './user-account.entity';
import { Email } from './email.vo';

/**
 * Contrato do getter `isPremium` — a determinação AUTORITATIVA de premium (usada
 * na emissão de token / no /users/me). Congela a semântica de `premiumUntil`:
 *   - null  → NUNCA expira (Hotmart/Cakto gravam null: o pagante mantém acesso)
 *   - futuro → ativo
 *   - passado → expirado (assinatura MP/Stripe que lapsou)
 * Se um refactor quebrar isto, pagantes Hotmart perdem acesso OU assinaturas
 * expiradas continuam premium — os dois são bugs de receita.
 */
const mkUser = (isPremium: boolean, premiumUntil: Date | null) =>
  UserAccount.rehydrate({
    email: Email.create('a@x.com'),
    displayName: 'A',
    emailVerified: true,
    isPremium,
    premiumUntil,
    createdAt: new Date(),
  }, 'u1');

const future = new Date(Date.now() + 30 * 86400000);
const past = new Date(Date.now() - 1000);

describe('UserAccount.isPremium — semântica de premiumUntil', () => {
  it('flag desligada → nunca premium (independe da data)', () => {
    expect(mkUser(false, null).isPremium).toBe(false);
    expect(mkUser(false, future).isPremium).toBe(false);
  });

  it('premium + premiumUntil null → premium (nunca expira — Hotmart/Cakto)', () => {
    expect(mkUser(true, null).isPremium).toBe(true);
  });

  it('premium + premiumUntil no futuro → premium', () => {
    expect(mkUser(true, future).isPremium).toBe(true);
  });

  it('premium + premiumUntil no passado → NÃO premium (expirado)', () => {
    expect(mkUser(true, past).isPremium).toBe(false);
  });
});
