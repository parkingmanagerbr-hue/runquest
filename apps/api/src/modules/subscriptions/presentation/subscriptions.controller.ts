import {
  Body, Controller, Get, HttpCode, Post, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CreateCheckoutUseCase } from '../application/create-checkout.usecase';
import { HandleWebhookUseCase } from '../application/handle-webhook.usecase';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../../shared/decorators/current-user.decorator';
import { Inject } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/subscription.repository';

class CheckoutDto { @IsIn(['MONTHLY', 'YEARLY']) plan!: 'MONTHLY' | 'YEARLY'; }

@ApiTags('subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(
    private readonly checkoutUc: CreateCheckoutUseCase,
    private readonly webhookUc: HandleWebhookUseCase,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
  ) {}

  @Post('subscriptions/checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async checkout(@CurrentUser() user: RequestUser, @Body() dto: CheckoutDto) {
    return this.checkoutUc.execute({ userId: user.id, email: user.email, plan: dto.plan });
  }

  @Get('subscriptions/me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    return (await this.subs.findByUserId(user.id)) ?? { status: 'none' };
  }

  @Post('webhooks/mercadopago')
  @HttpCode(200)
  async webhook(@Req() req: Request) {
    // req.body é Buffer (raw middleware no main.ts)
    const raw = req.body as unknown as Buffer;
    return this.webhookUc.execute(raw, req.headers);
  }
}
