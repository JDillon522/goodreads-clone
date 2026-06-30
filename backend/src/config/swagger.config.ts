import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const swaggerPaths = {
  json: 'docs-json',
  ui: 'docs',
} as const;

export function setupSwagger(app: INestApplication, apiPrefix: string): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bookshelf API')
    .setDescription('Backend API for Bookshelf, a personal reading tracker.')
    .setVersion(process.env.npm_package_version ?? '0.1.0')
    .addServer('/', 'Current host')
    .addServer(`/${apiPrefix}`, 'API prefix')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT or guest token',
        description:
          'Paste a signed-in user access token or a guest token. Auth-only routes require a user access token.',
      },
      'bearer',
    )
    .addTag('System', 'Health, readiness, and backend operational checks.')
    .addTag('Auth', 'Signup, signin, token refresh, signout, and password reset.')
    .addTag('Guest', 'Guest session creation and session-scoped demo data.')
    .addTag('Books', 'External book search and normalized provider metadata.')
    .addTag('Shelves', 'Shelf creation, ordering, renaming, deletion, and counts.')
    .addTag('Library', 'User and guest library items, book detail, notes, and ratings.')
    .addTag('Progress', 'Reading progress updates and history.')
    .addTag('Goals', 'Annual reading goal setup, progress, and completion state.')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup(swaggerPaths.ui, app, swaggerDocument, {
    jsonDocumentUrl: swaggerPaths.json,
    swaggerOptions: {
      deepLinking: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      operationsSorter: 'alpha',
      persistAuthorization: true,
      tagsSorter: 'alpha',
      tryItOutEnabled: true,
    },
  });
}
