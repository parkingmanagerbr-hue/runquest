import { normalizeEmail } from './normalize-email';

describe('normalizeEmail', () => {
  it('minúsculas + trim (igual ao Email value object no cadastro)', () => {
    expect(normalizeEmail('  Ana@RunQuest.com ')).toBe('ana@runquest.com');
    expect(normalizeEmail('JOAO@X.COM')).toBe('joao@x.com');
  });

  it('email já normalizado passa igual', () => {
    expect(normalizeEmail('ana@runquest.com')).toBe('ana@runquest.com');
  });

  it('null/undefined/vazio → string vazia (não quebra o lookup)', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail('   ')).toBe('');
  });
});
