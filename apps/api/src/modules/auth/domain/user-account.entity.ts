import { Entity } from '../../../shared/kernel/entity';
import { Email } from './email.vo';
import { Password } from './password.vo';

export interface UserAccountProps {
  email: Email;
  password?: Password;
  googleId?: string;
  displayName: string;
  emailVerified: boolean;
  isPremium: boolean;
  premiumUntil?: Date | null;
  createdAt: Date;
}

export class UserAccount extends Entity<UserAccountProps> {
  static register(input: { email: Email; password: Password; displayName: string }): UserAccount {
    return new UserAccount({
      email: input.email,
      password: input.password,
      displayName: input.displayName.trim(),
      emailVerified: false,
      isPremium: false,
      premiumUntil: null,
      createdAt: new Date(),
    });
  }

  static fromGoogle(input: { email: Email; googleId: string; displayName: string }): UserAccount {
    return new UserAccount({
      email: input.email,
      googleId: input.googleId,
      displayName: input.displayName,
      emailVerified: true,
      isPremium: false,
      premiumUntil: null,
      createdAt: new Date(),
    });
  }

  static rehydrate(props: UserAccountProps, id: string): UserAccount {
    return new UserAccount(props, id);
  }

  get email(): string { return this.props.email.value; }
  get displayName(): string { return this.props.displayName; }
  get password(): Password | undefined { return this.props.password; }
  get googleId(): string | undefined { return this.props.googleId; }
  get isPremium(): boolean {
    if (!this.props.isPremium) return false;
    if (this.props.premiumUntil && this.props.premiumUntil < new Date()) return false;
    return true;
  }

  attachGoogle(googleId: string): void {
    if (this.props.googleId && this.props.googleId !== googleId) {
      throw new Error('Account already linked to another Google ID');
    }
    this.props.googleId = googleId;
    this.props.emailVerified = true;
  }

  toPrismaData() {
    return {
      email: this.props.email.value,
      passwordHash: this.props.password?.hash ?? null,
      googleId: this.props.googleId ?? null,
      displayName: this.props.displayName,
      emailVerified: this.props.emailVerified,
      isPremium: this.props.isPremium,
      premiumUntil: this.props.premiumUntil ?? null,
    };
  }
}
