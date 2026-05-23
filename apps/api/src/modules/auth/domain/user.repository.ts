import { UserAccount } from './user-account.entity';

/** Port (interface). Implementação fica em infrastructure/. Inversion of Dependency. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
  findByGoogleId(googleId: string): Promise<UserAccount | null>;
  save(user: UserAccount): Promise<UserAccount>;
}
