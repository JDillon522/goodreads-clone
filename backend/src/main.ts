import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';

/**
 * Bootstraps the Nest backend with the configured API prefix, CORS settings, validation pipe, and
 * Swagger/OpenAPI documentation.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('API_PREFIX') ?? 'api';
  const port = Number(configService.get<string>('PORT') ?? 3000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN');

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((origin) => origin.trim()) : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  setupSwagger(app, apiPrefix);

  await app.listen(port);
}

void bootstrap();
