import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { ApiErrorResponse } from "@digital-self/shared";
import type { Response } from "express";

import type { RequestWithRequestId } from "./request-context";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithRequestId>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = buildErrorResponse(exception, request.requestId ?? "unknown");

    response.status(status).json(errorResponse);
  }
}

function buildErrorResponse(exception: unknown, requestId: string): ApiErrorResponse {
  if (exception instanceof HttpException) {
    const payload = exception.getResponse();

    if (typeof payload === "string") {
      return {
        data: null,
        error: {
          code: exception.name,
          message: payload,
        },
        requestId,
      };
    }

    if (typeof payload === "object" && payload !== null) {
      const normalizedPayload = payload as Record<string, unknown>;
      const message = normalizedPayload.message;

      return {
        data: null,
        error: {
          code: String(normalizedPayload.error ?? exception.name),
          message: Array.isArray(message) ? message.join("; ") : String(message ?? exception.message),
          details: normalizedPayload,
        },
        requestId,
      };
    }
  }

  return {
    data: null,
    error: {
      code: "InternalServerError",
      message: "Internal server error",
    },
    requestId,
  };
}
