type ApiSuccess<T> = {
  data: T;
  error: null;
  requestId: string;
};

type ApiFailure = {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export class ApiClientError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, options?: { status?: number; requestId?: string }) {
    super(message);
    this.name = "ApiClientError";
    this.status = options?.status ?? 500;
    this.requestId = options?.requestId;
  }
}

const defaultApiBaseUrl = "http://localhost:3001";

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, "");
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: { allowEmpty?: boolean; emptyData?: T },
): Promise<{ data: T; requestId: string }> {
  const headers = new Headers(init?.headers);
  const body = init?.body;
  const isFormDataRequest = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormDataRequest && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  let payload: ApiEnvelope<T> | null = null;

  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    if (options?.allowEmpty && response.ok) {
      return {
        data: options.emptyData as T,
        requestId: response.headers.get("x-request-id") ?? "",
      };
    }

    if (!response.ok) {
      throw new ApiClientError("服务返回了无法识别的响应。", { status: response.status });
    }
  }

  if (!payload) {
    throw new ApiClientError("服务没有返回可用数据。", { status: response.status });
  }

  if (!response.ok || payload.error) {
    throw new ApiClientError(payload.error?.message ?? "请求失败，请稍后重试。", {
      status: response.status,
      requestId: payload.requestId,
    });
  }

  return {
    data: payload.data,
    requestId: payload.requestId,
  };
}
