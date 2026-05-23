import * as argon2 from 'argon2';

/** Value Object: senha sempre via hash argon2id, nunca em plaintext. */
export class Password {
  private constructor(public readonly hash: string) {}

  static async fromPlain(plain: string): Promise<Password> {
    if (plain.length < 8) throw new Error('Password must be at least 8 chars');
    if (plain.length > 128) throw new Error('Password too long');
    const hash = await argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 19_456, // 19 MiB
      timeCost: 2,
      parallelism: 1,
    });
    return new Password(hash);
  }

  static fromHash(hash: string): Password {
    return new Password(hash);
  }

  async matches(plain: string): Promise<boolean> {
    return argon2.verify(this.hash, plain);
  }
}
