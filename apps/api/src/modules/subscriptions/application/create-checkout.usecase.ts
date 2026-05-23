import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_GATEWAY, PaymentGateway, SubPlan } from '../domain/payment-gateway';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/subscription.repository';

@Injectable()
export class CreateCheckoutUseCase {
  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
  ) {}

  async execute(input: { userId: string; email: string; plan: SubPlan }): Promise<{ initPoint: string }> {
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
