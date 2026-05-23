import type { NextFunction, Request, Response } from "express";
import type { MongoServerError } from "mongodb";
import ApiError from "../errors/ApiError.js";
import env from "../../config/env.js";
import logger from "../logger.js";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

interface MongooseLikeError extends Error {
  statusCode?: number;
  errors?: Array<{ field?: string; message: string }>;
  path?: string;
  value?: unknown;
  code?: number;
  keyValue?: Record<string, unknown>;
  stack?: string;
}

export const errorHandler = (
  err: MongooseLikeError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors || [];

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${String(err.value)}`;
    errors = [{ field: err.path, message }];
  }

  if (err.name === "ValidationError") {
    statusCode = 422;
    message = "Validation failed";
    const validationErrors = (
      err as { errors?: Record<string, { path: string; message: string }> }
    ).errors;
    if (validationErrors) {
      errors = Object.values(validationErrors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
    }
  }

  const mongoErr = err as MongoServerError;
  if (mongoErr.code === 11000) {
    statusCode = 409;
    const field = Object.keys(mongoErr.keyValue ?? {})[0] ?? "field";
    message = `Duplicate value for field: ${field}`;
    errors = [{ field, message: `${field} already exists` }];
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired";
  }

  if ((err as { code?: string }).code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    message = "File too large";
  }

  if ((err as { code?: string }).code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;
    message = "Unexpected file field";
  }

  if (statusCode >= 500) {
    logger.error({ err, statusCode }, message);
  } else if (env.NODE_ENV === "development") {
    logger.warn({ statusCode, errors }, message);
  }

  const response: Record<string, unknown> = {
    success: false,
    message,
  };

  if (errors.length > 0) {
    response.errors = errors;
  }

  if (env.NODE_ENV === "development" && statusCode === 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
