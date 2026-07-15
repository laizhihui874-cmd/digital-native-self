import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import type { ApiErrorResponse } from "@digital-self/shared";

import { AppModule } from "./app.module";
import { loadRootEnv } from "./config/load-root-env";
import { resolveApiHost } from "./config/server-host";
import { ApiResponseInterceptor } from "./rest/api-response.interceptor";
import { GlobalExceptionFilter } from "./rest/global-exception.filter";
import { requestIdHeaderName, type RequestWithRequestId } from "./rest/request-context";
import { RequestIdMiddleware } from "./rest/request-id.middleware";

const defaultCorsAllowedOrigins = [
  "http://localhost:3201",
  "http://localhost:3202",
  "http://localhost:3000",
  "http://localhost:3002",
] as const;

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const app = await NestFactory.create(AppModule);
  const requestIdMiddleware = new RequestIdMiddleware();
  const corsAllowedOrigins = getCorsAllowedOrigins();

  app.setGlobalPrefix("api");
  app.use((request: RequestWithRequestId, response: Response, next: NextFunction) => {
    requestIdMiddleware.use(request, response, () => {
      const origin = request.headers.origin;

      if (!origin || corsAllowedOrigins.includes(origin)) {
        next();
        return;
      }

      const errorResponse: ApiErrorResponse = {
        data: null,
        error: {
          code: "Forbidden",
          message: `Origin ${origin} is not allowed by CORS.`,
        },
        requestId: request.requestId ?? "unknown",
      };

      response.setHeader(requestIdHeaderName, request.requestId ?? "unknown");
      response.status(403).json(errorResponse);
    });
  });
  app.enableCors({
    origin: corsAllowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = Number(process.env.PORT ?? 3001);
  const host = resolveApiHost(process.env.API_HOST);
  await app.listen(port, host);
}

void bootstrap();

function getCorsAllowedOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (!configuredOrigins || configuredOrigins.length === 0) {
    return [...defaultCorsAllowedOrigins];
  }

  return Array.from(new Set(configuredOrigins));
}
