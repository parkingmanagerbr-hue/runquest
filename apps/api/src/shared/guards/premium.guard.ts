import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PremiumRequiredError } from '../errors/domain-error';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.id as string | undefined;
    if (!userId) throw new PremiumRequiredError();

    // Fonte autoritativa = DB (JWT pode estar stale)
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true, premiumUntil: true },
    });
    const ok = !!u?.isPremium && (!u.premiumUntil || u.premiumUntil > new Date());
    if (!ok) throw new PremiumRequiredError();
    return true;
  }
}
