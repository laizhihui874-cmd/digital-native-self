import type { Request } from "express";

export const requestIdHeaderName = "x-request-id";

export type RequestWithRequestId = Request & {
  requestId?: string;
};
