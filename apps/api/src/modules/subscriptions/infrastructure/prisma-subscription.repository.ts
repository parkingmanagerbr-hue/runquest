import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SubscriptionRepository, SubscriptionRecord, SubPlan,
} from '../domain/subscription.repository';

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(r: any): SubscriptionRecord {
    return {
      id: r.id, userId: r.userId, mpPreapprovalId: r.mpPreapprovalId,
      plan: r.plan as SubPlan, status: r.status,
      nextPaymentAt: r.nextPaymentAt, cancelledAt: r.cancelledAt,
    };
  }

  async upsertByMpId(data: {
    userId: string; mpPreapprovalId: string; plan: SubPlan; status: string; nextPaymentAt?: Date | null;
  }): Promise<SubscriptionRecord> {
    const row = await this.prisma.subscription.upsert({
      where: { mpPreapprovalId: data.mpPreapprovalId },
      update: { status: data.status, nextPaymentAt: data.nextPaymentAt ?? null },
      create: {
        userId: data.userId, mpPreapprovalId: data.mpPreapprovalId,
        plan: data.plan as any, status: data.status,
        nextPaymentAt: data.nextPaymentAt ?? null,
      },
    });
    return this.toRecord(row);
  }
  async findByMpId(mpId: string) {
    const r = await this.prisma.subscription.findUnique({ where: { mpPreapprovalId: mpId } });
    return r ? this.toRecord(r) : null;
  }
  async findByUserId(userId: string) {
    const r = await this.prisma.subscription.findUnique({ where: { userId } });
    return r ? this.toRecord(r) : null;
  }
  async updateStatus(mpId: string, status: string, nextPaymentAt?: Date | null) {
    await this.prisma.subscription.update({
      where: { mpPreapprovalId: mpId },
      data: { status, nextPaymentAt: nextPaymentAt ?? undefined },
    });
  }
  async markCancelled(mpId: string) {
    await this.prisma.subscription.update({
      where: { mpPreapprovalId: mpId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
  }
}
