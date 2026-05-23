import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Email } from '../domain/email.vo';
import { Password } from '../domain/password.vo';
import { UserAccount } from '../domain/user-account.entity';
import { UserRepository } from '../domain/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: NonNullable<Awaited<ReturnType<PrismaService['user']['findUnique']>>>): UserAccount {
    return UserAccount.rehydrate({
      email: Email.create(row.email),
      password: row.passwordHash ? Password.fromHash(row.passwordHash) : undefined,
      googleId: row.googleId ?? undefined,
      displayName: row.displayName,
      emailVerified: row.emailVerified,
      isPremium: row.isPremium,
      premiumUntil: row.premiumUntil,
      createdAt: row.createdAt,
    }, row.id);
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }
  async findById(id: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }
  async findByGoogleId(googleId: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({ where: { googleId } });
    return row ? this.toDomain(row) : null;
  }
  async save(user: UserAccount): Promise<UserAccount> {
    const data = user.toPrismaData();
    const row = await this.prisma.user.upsert({
      where: { id: user.id },
      update: data,
      create: { id: user.id, ...data },
    });
    return this.toDomain(row);
  }
}
