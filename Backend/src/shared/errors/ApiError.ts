export interface FieldError {
  field?: string;
  message: string;
}

export default class ApiError extends Error {
  statusCode: number;
  errors: FieldError[];
  isOperational: boolean;

  constructor(statusCode: number, message: string, errors: FieldError[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", errors: FieldError[] = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static payloadTooLarge(message = "Payload too large") {
    return new ApiError(413, message);
  }

  static validation(message = "Validation failed", errors: FieldError[] = []) {
    return new ApiError(422, message, errors);
  }

  static tooManyRequests(
    message = "Too many requests, please try again later"
  ) {
    return new ApiError(429, message);
  }

  static serviceUnavailable(
    message = "Service temporarily unavailable, please try again later"
  ) {
    return new ApiError(503, message);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message);
  }
}
