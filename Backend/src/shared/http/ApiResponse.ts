import type { Response } from "express";

export default class ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  meta: Record<string, unknown> | null;

  constructor(
    statusCode: number,
    message: string,
    data: T | null = null,
    meta: Record<string, unknown> | null = null
  ) {
    this.success = true;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  send(res: Response) {
    const body: Record<string, unknown> = {
      success: this.success,
      message: this.message,
      data: this.data,
    };

    if (this.meta) {
      body.meta = this.meta;
    }

    return res.status(this.statusCode).json(body);
  }

  static ok<T>(
    message: string,
    data?: T,
    meta?: Record<string, unknown>
  ) {
    return new ApiResponse(200, message, data ?? null, meta ?? null);
  }

  static created<T>(message: string, data?: T) {
    return new ApiResponse(201, message, data ?? null);
  }

  static noContent(message = "No content") {
    return new ApiResponse(204, message);
  }
}
