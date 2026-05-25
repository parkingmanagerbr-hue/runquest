import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY, PaymentGateway, SubPlan } from '../domain/payment-gateway';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/subscription.repository';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CreateCheckoutUseCase {
  private readonly logger = new Logger(CreateCheckoutUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: { userId: string; email: string; plan: SubPlan }): Promise<{ initPoint: string }> {
    // Owner sempre Premium grátis — nunca cobra
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { isOwner: true },
    });
    if (user?.isOwner) {
      throw new ForbiddenException('OWNER_NEVER_CHARGED: você é dono do app, premium vitalício');
    }

    // Se já existe subscription pending do mesmo user, cancela no MP antes de criar nova
    const existing = await this.subs.findByUserId(input.userId);
    if (existing && existing.status === 'pending') {
      try {
        await this.gateway.cancel(existing.mpPreapprovalId);
        this.logger.log(`Cancelled pending sub ${existing.mpPreapprovalId} before new checkout`);
      } catch (e) {
        // não bloqueia novo checkout se cancel falhar
        this.logger.warn(`Could not cancel pending sub: ${(e as Error).message}`);
      }
      await this.subs.markCancelled(existing.mpPreapprovalId);
    }

    const checkout = await this.gateway.createCheckout(input);
    await this.subs.upsertByMpId({
      userId: input.userId,
      mpPreapprovalId: checkout.preapprovalId,
      plan: input.plan,
      status: 'pending',
    });
    return { initPoint: checkout.initPoint };
  }
}
