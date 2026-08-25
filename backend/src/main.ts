import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable Smart Configurable CORS
  const corsOriginEnv = process.env.CORS_ORIGIN;

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (like Postman, curl, server-to-server)
      if (!requestOrigin) return callback(null, true);

      if (!corsOriginEnv || corsOriginEnv.trim() === '*' || corsOriginEnv.trim() === '') {
        return callback(null, true);
      }

      const allowedList = corsOriginEnv
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);

      const cleanOrigin = requestOrigin.replace(/\/$/, '');

      if (
        allowedList.includes('*') ||
        allowedList.includes(cleanOrigin) ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.includes('vercel.app')
      ) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization',
  });

  // Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Inventory Management System API')
    .setDescription('Backend API documentation for YM Inventory Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
