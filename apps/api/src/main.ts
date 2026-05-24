import 'reflect-metadata';

// BigInt JSON serialization (Strava activity IDs, etc.)
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, raw } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/errors/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const cfg = app.get(ConfigService);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: cfg.get<string>('APP_BASE_URL', 'http://localhost:3000'),
    credentials: true,
  });

  // Raw body para validar HMAC do webhook MP
  app.use('/api/webhooks/mercadopago', raw({ type: 'application/json' }));
  app.use(json({ limit: '2mb' }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (cfg.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('RunQuest API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = cfg.get<number>('API_PORT', 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`[runquest-api] listening on :${port}`);
}

bootstrap();
