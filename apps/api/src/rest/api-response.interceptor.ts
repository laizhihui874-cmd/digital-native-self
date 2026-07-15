import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { ApiResult } from "@digital-self/shared";
import { map, type Observable } from "rxjs";

import type { RequestWithRequestId } from "./request-context";

type SuccessEnvelope<T> = Extract<ApiResult<T>, { error: null }>;

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T>> {
    const request = context.switchToHttp().getRequest<RequestWithRequestId>();
    const requestId = request.requestId ?? "unknown";

    return next.handle().pipe(
      map((data) => {
        if (isApiEnvelope(data)) {
          return data as SuccessEnvelope<T>;
        }

        return {
          data,
          error: null,
          requestId,
        };
      }),
    );
  }
}

function isApiEnvelope(value: unknown): value is Extract<ApiResult<unknown>, { requestId: string }> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeResult = value as Record<string, unknown>;

  return (
    Object.prototype.hasOwnProperty.call(maybeResult, "data") &&
    Object.prototype.hasOwnProperty.call(maybeResult, "error") &&
    typeof maybeResult.requestId === "string"
  );
}
