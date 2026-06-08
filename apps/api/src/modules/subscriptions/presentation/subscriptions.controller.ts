import {
  Body, Controller, Get, HttpCode, Post, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CreateCheckoutUseCase } from '../application/create-checkout.usecase';
import { HandleWebhookUseCase } from '../application/handle-webhook.usecase';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../../shared/decorators/current-user.decorator';
import { Inject } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/subscription.repository';
import { STRIPE_GATEWAY, HOTMART_GATEWAY, CAKTO_GATEWAY, PaymentGateway } from '../domain/payment-gateway';

class CheckoutDto {
  @IsIn(['MONTHLY', 'YEARLY']) plan!: 'MONTHLY' | 'YEARLY';
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() locale?: string;
}

@ApiTags('subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(
    private readonly checkoutUc: CreateCheckoutUseCase,
    private readonly webhookUc: HandleWebhookUseCase,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(STRIPE_GATEWAY) private readonly stripe: PaymentGateway,
    @Inject(HOTMART_GATEWAY) private readonly hotmart: PaymentGateway,
    @Inject(CAKTO_GATEWAY) private readonly cakto: PaymentGateway,
  ) {}

  @Post('subscriptions/checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async checkout(@CurrentUser() user: RequestUser, @Body() dto: CheckoutDto) {
    return this.checkoutUc.execute({
      userId: user.id, email: user.email, plan: dto.plan, currency: dto.currency, locale: dto.locale,
    });
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

  @Post('webhooks/stripe')
  @HttpCode(200)
  async stripeWebhook(@Req() req: Request) {
    const raw = req.body as unknown as Buffer;
    return this.webhookUc.execute(raw, req.headers, { gateway: this.stripe, provider: 'stripe' });
  }

  @Post('webhooks/hotmart')
  @HttpCode(200)
  async hotmartWebhook(@Req() req: Request) {
    const raw = req.body as unknown as Buffer;
    return this.webhookUc.execute(raw, req.headers, { gateway: this.hotmart, provider: 'hotmart' });
  }

  @Post('webhooks/cakto')
  @HttpCode(200)
  async caktoWebhook(@Req() req: Request) {
    const raw = req.body as unknown as Buffer;
    return this.webhookUc.execute(raw, req.headers, { gateway: this.cakto, provider: 'cakto' });
  }
}
