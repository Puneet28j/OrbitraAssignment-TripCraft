import { isAxiosError } from 'axios';

export interface ApiFieldError {
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: ApiFieldError[];
}

export class AppError extends Error {
  statusCode?: number;
  errors: ApiFieldError[];

  constructor(message: string, statusCode?: number, errors: ApiFieldError[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;
    if (data?.message) return data.message;
    if (error.message) return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function parseApiError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;
    return new AppError(
      data?.message || error.message || 'Request failed',
      error.response?.status,
      data?.errors ?? []
    );
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError('Something went wrong');
}
