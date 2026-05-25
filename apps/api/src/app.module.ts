import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { RunsModule } from './modules/runs/runs.module';
import { HealthModule } from './modules/health/health.module';
import { StravaModule } from './modules/strava/strava.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { MissionsModule } from './modules/missions/missions.module';
import { TerritoriesModule } from './modules/territories/territories.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    RunsModule,
    StravaModule,
    WorkoutsModule,
    MissionsModule,
    TerritoriesModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
