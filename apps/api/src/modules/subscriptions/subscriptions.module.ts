import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsController } from './presentation/subscriptions.controller';
import { CreateCheckoutUseCase } from './application/create-checkout.usecase';
import { HandleWebhookUseCase } from './application/handle-webhook.usecase';
import { PAYMENT_GATEWAY } from './domain/payment-gateway';
import { SUBSCRIPTION_REPOSITORY } from './domain/subscription.repository';
import { MercadoPagoGateway } from './infrastructure/mercadopago.gateway';
import { PrismaSubscriptionRepository } from './infrastructure/prisma-subscription.repository';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [SubscriptionsController],
  providers: [
    CreateCheckoutUseCase, HandleWebhookUseCase,
    { provide: PAYMENT_GATEWAY, useClass: MercadoPagoGateway },
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PrismaSubscriptionRepository },
  ],
})
export class SubscriptionsModule {}
