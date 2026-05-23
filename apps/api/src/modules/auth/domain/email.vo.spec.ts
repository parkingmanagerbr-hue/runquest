import { Email } from './email.vo';

describe('Email VO', () => {
  it('normaliza casing e trim', () => {
    expect(Email.create('  Foo@BAR.com ').value).toBe('foo@bar.com');
  });
  it('rejeita formato inválido', () => {
    expect(() => Email.create('not-an-email')).toThrow();
    expect(() => Email.create('a@b')).toThrow();
  });
  it('rejeita email enorme', () => {
    expect(() => Email.create('a'.repeat(250) + '@x.com')).toThrow();
  });
});
