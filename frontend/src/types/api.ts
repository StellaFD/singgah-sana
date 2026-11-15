/**
 * Amplop Standar Respons API Gateway Frontend
 */

export interface ApiPagination {
  totalData: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  totalCount?: number;
  totalPages?: number;
  page?: number;
  perPage?: number;
  total?: number;
  limit?: number;
  truncated?: boolean;
  isTruncated?: boolean;
  pagination?: ApiPagination;
  isNetworkError?: boolean;
  isValidationError?: boolean;
  notFound?: boolean;
  unavailable?: boolean;
  isMock?: boolean;
}
