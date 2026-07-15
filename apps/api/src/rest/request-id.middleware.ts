import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";

import { requestIdHeaderName, type RequestWithRequestId } from "./request-context";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithRequestId, response: Response, next: NextFunction): void {
    const incomingRequestId = request.headers[requestIdHeaderName];
    const requestId =
      typeof incomingRequestId === "string" && isSafeRequestId(incomingRequestId)
        ? incomingRequestId
        : randomUUID();

    request.requestId = requestId;
    response.setHeader(requestIdHeaderName, requestId);

    next();
  }
}

function isSafeRequestId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(value);
}
