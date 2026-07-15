type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

type ApiSuccess<T> = {
  data: T;
  error: null;
  requestId: string;
};

type ApiFailure = {
  data: null;
  error: ApiError;
  requestId: string;
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export const DEFAULT_DIGITAL_SELF_API_BASE_URL = "http://localhost:3001";

const API_BASE_URL_ENV_KEYS = [
  "DIGITAL_SELF_API_BASE_URL",
  "NEXT_PUBLIC_API_BASE_URL",
] as const;

export interface DigitalSelfApiClientOptions {
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
}

export interface DigitalSelfApiResponse<T> {
  data: T;
  requestId: string;
}

export class DigitalSelfApiClientError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      status?: number;
      requestId?: string;
      code?: string;
      details?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "DigitalSelfApiClientError";
    this.status = options.status ?? 500;
    this.requestId = options.requestId;
    this.code = options.code;
    this.details = options.details;
  }
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

export function resolveDigitalSelfApiBaseUrl(apiBaseUrl?: string): string {
  if (typeof apiBaseUrl === "string" && apiBaseUrl.trim().length > 0) {
    return normalizeApiBaseUrl(apiBaseUrl.trim());
  }

  for (const envKey of API_BASE_URL_ENV_KEYS) {
    const value = process.env[envKey];

    if (typeof value === "string" && value.trim().length > 0) {
      return normalizeApiBaseUrl(value.trim());
    }
  }

  return DEFAULT_DIGITAL_SELF_API_BASE_URL;
}

export class DigitalSelfApiClient {
  private readonly apiBaseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: DigitalSelfApiClientOptions = {}) {
    this.apiBaseUrl = resolveDigitalSelfApiBaseUrl(options.apiBaseUrl);
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async request<T>(
    path: string,
    options: {
      method: "GET" | "POST";
      searchParams?: URLSearchParams;
      body?: unknown;
      signal?: AbortSignal;
    },
  ): Promise<DigitalSelfApiResponse<T>> {
    const url = new URL(path, `${this.apiBaseUrl}/`);

    if (options.searchParams) {
      url.search = options.searchParams.toString();
    }

    let response: Response;

    try {
      response = await this.fetchFn(url.toString(), {
        method: options.method,
        headers: {
          Accept: "application/json",
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        signal: options.signal,
      });
    } catch (error) {
      throw new DigitalSelfApiClientError(
        `Failed to reach Digital Self API at ${this.apiBaseUrl}. ${
          error instanceof Error ? error.message : "Unknown network error."
        }`,
        {
          code: "API_REQUEST_FAILED",
          details: {
            path,
          },
        },
      );
    }

    let payload: ApiResult<T> | null = null;

    try {
      payload = (await response.json()) as ApiResult<T>;
    } catch {
      throw new DigitalSelfApiClientError(
        `Digital Self API returned a non-JSON response for ${path}.`,
        {
          status: response.status,
          code: "INVALID_API_RESPONSE",
          details: {
            path,
          },
        },
      );
    }

    if (!response.ok || payload.error) {
      throw new DigitalSelfApiClientError(
        payload.error?.message ??
          `Digital Self API request failed with HTTP ${response.status}.`,
        {
          status: response.status,
          requestId: payload.requestId,
          code: payload.error?.code ?? "API_RESPONSE_ERROR",
          details: payload.error?.details,
        },
      );
    }

    return {
      data: payload.data,
      requestId: payload.requestId,
    };
  }

  async get<T>(
    path: string,
    options: {
      searchParams?: URLSearchParams;
      signal?: AbortSignal;
    } = {},
  ): Promise<DigitalSelfApiResponse<T>> {
    return this.request<T>(path, {
      method: "GET",
      searchParams: options.searchParams,
      signal: options.signal,
    });
  }

  async post<T>(
    path: string,
    options: {
      body?: unknown;
      signal?: AbortSignal;
    } = {},
  ): Promise<DigitalSelfApiResponse<T>> {
    return this.request<T>(path, {
      method: "POST",
      body: options.body,
      signal: options.signal,
    });
  }
}

export function createDigitalSelfApiClient(
  options: DigitalSelfApiClientOptions = {},
): DigitalSelfApiClient {
  return new DigitalSelfApiClient(options);
}
