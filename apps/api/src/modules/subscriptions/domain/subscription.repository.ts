export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');

export type SubPlan = 'MONTHLY' | 'YEARLY';

export interface SubscriptionRecord {
  id: string;
  userId: string;
  mpPreapprovalId: string;
  plan: SubPlan;
  status: string;
  nextPaymentAt: Date | null;
  cancelledAt: Date | null;
}

export interface SubscriptionRepository {
  upsertByMpId(data: {
    userId: string;
    mpPreapprovalId: string;
    plan: SubPlan;
    status: string;
    nextPaymentAt?: Date | null;
  }): Promise<SubscriptionRecord>;
  findByMpId(mpId: string): Promise<SubscriptionRecord | null>;
  findByUserId(userId: string): Promise<SubscriptionRecord | null>;
  updateStatus(mpId: string, status: string, nextPaymentAt?: Date | null): Promise<void>;
  markCancelled(mpId: string): Promise<void>;
}
