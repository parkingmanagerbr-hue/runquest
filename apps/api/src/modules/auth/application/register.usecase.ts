import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../domain/email.vo';
import { Password } from '../domain/password.vo';
import { UserAccount } from '../domain/user-account.entity';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { EmailAlreadyInUseError } from '../../../shared/errors/domain-error';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(input: RegisterInput): Promise<UserAccount> {
    const email = Email.create(input.email);
    const existing = await this.users.findByEmail(email.value);
    if (existing) throw new EmailAlreadyInUseError();

    const password = await Password.fromPlain(input.password);
    const user = UserAccount.register({ email, password, displayName: input.displayName });
    return this.users.save(user);
  }
}
