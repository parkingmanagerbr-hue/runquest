import { RegisterUseCase } from './register.usecase';
import { UserRepository } from '../domain/user.repository';
import { UserAccount } from '../domain/user-account.entity';
import { EmailAlreadyInUseError } from '../../../shared/errors/domain-error';

class InMemoryUserRepo implements UserRepository {
  store = new Map<string, UserAccount>();
  async findByEmail(email: string) {
    for (const u of this.store.values()) if (u.email === email) return u;
    return null;
  }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByGoogleId(gid: string) {
    for (const u of this.store.values()) if (u.googleId === gid) return u;
    return null;
  }
  async save(u: UserAccount) { this.store.set(u.id, u); return u; }
}

describe('RegisterUseCase', () => {
  it('cria um novo usuário com email normalizado', async () => {
    const repo = new InMemoryUserRepo();
    const uc = new RegisterUseCase(repo);
    const user = await uc.execute({
      email: '  Ana@RUNQUEST.com ',
      password: 'senha-super-segura-123',
      displayName: 'Ana',
    });
    expect(user.email).toBe('ana@runquest.com');
    expect(user.displayName).toBe('Ana');
    expect(repo.store.size).toBe(1);
  });

  it('rejeita email duplicado', async () => {
    const repo = new InMemoryUserRepo();
    const uc = new RegisterUseCase(repo);
    await uc.execute({ email: 'a@x.com', password: 'senha-segura-123', displayName: 'A' });
    await expect(
      uc.execute({ email: 'a@x.com', password: 'outra-senha-456', displayName: 'B' }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it('rejeita senha curta', async () => {
    const repo = new InMemoryUserRepo();
    const uc = new RegisterUseCase(repo);
    await expect(
      uc.execute({ email: 'a@x.com', password: 'short', displayName: 'A' }),
    ).rejects.toThrow(/at least 8/);
  });
});
