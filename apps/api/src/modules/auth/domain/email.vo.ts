/** Value Object: e-mail validado e normalizado. */
export class Email {
  private static readonly RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const v = raw.trim().toLowerCase();
    if (!Email.RX.test(v)) throw new Error('Invalid email format');
    if (v.length > 254) throw new Error('Email too long');
    return new Email(v);
  }
}
