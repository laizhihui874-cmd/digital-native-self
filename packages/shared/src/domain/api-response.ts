export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> = {
  data: T;
  error: null;
  requestId: string;
};

export type ApiErrorResponse = {
  data: null;
  error: ApiError;
  requestId: string;
};

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type PaginatedData<T> = {
  items: T[];
  pagination: PaginationMeta;
};
