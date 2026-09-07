import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend (supports localhost on any port, 127.0.0.1, FRONTEND_URL)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Allow any localhost / 127.0.0.1 origin or FRONTEND_URL
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin);
      const isConfiguredFrontend = process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL;

      if (isLocalhost || isConfiguredFrontend) {
        return callback(null, true);
      }

      // Allow in dev mode / fallback
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`🚀 API server listening on ${host}:${port} (${process.env.NODE_ENV || 'development'} mode)`);
}
bootstrap();

