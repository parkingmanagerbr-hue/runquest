import { isPremiumActive } from './premium';

const future = new Date(Date.now() + 30 * 86400000);
const past = new Date(Date.now() - 1000);

describe('isPremiumActive', () => {
  it('owner tem acesso total (independe de flag/data)', () => {
    expect(isPremiumActive({ isOwner: true })).toBe(true);
    expect(isPremiumActive({ isOwner: true, isPremium: false, premiumUntil: past })).toBe(true);
  });

  it('premium + premiumUntil null → ativo (Hotmart/Cakto nunca expira)', () => {
    expect(isPremiumActive({ isPremium: true, premiumUntil: null })).toBe(true);
    expect(isPremiumActive({ isPremium: true })).toBe(true);
  });

  it('premium + futuro → ativo', () => {
    expect(isPremiumActive({ isPremium: true, premiumUntil: future })).toBe(true);
  });

  it('premium + passado → EXPIRADO (o gap que isto fecha)', () => {
    // Antes os gates de IA só olhavam isPremium=true e liberavam mesmo expirado.
    expect(isPremiumActive({ isPremium: true, premiumUntil: past })).toBe(false);
  });

  it('sem premium → não', () => {
    expect(isPremiumActive({ isPremium: false })).toBe(false);
    expect(isPremiumActive({})).toBe(false);
    expect(isPremiumActive(null)).toBe(false);
  });
});
