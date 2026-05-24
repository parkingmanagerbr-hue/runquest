import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StravaController } from './presentation/strava.controller';
import { ConnectStravaUseCase } from './application/connect-strava.usecase';
import { ImportStravaActivitiesUseCase } from './application/import-activities.usecase';
import { ExportRunToStravaUseCase } from './application/export-run.usecase';
import { EnsureValidStravaTokenService } from './application/ensure-valid-token.service';
import { STRAVA_GATEWAY } from './domain/strava-gateway';
import { STRAVA_TOKEN_REPOSITORY } from './domain/strava-token.repository';
import { StravaHttpGateway } from './infrastructure/strava-http.gateway';
import { PrismaStravaTokenRepository } from './infrastructure/prisma-strava-token.repository';
import { CryptoService } from '../../shared/kernel/crypto.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [StravaController],
  providers: [
    CryptoService,
    ConnectStravaUseCase,
    ImportStravaActivitiesUseCase,
    ExportRunToStravaUseCase,
    EnsureValidStravaTokenService,
    { provide: STRAVA_GATEWAY, useClass: StravaHttpGateway },
    { provide: STRAVA_TOKEN_REPOSITORY, useClass: PrismaStravaTokenRepository },
  ],
})
export class StravaModule {}
