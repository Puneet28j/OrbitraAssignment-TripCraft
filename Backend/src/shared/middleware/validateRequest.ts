import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import ApiError from "../errors/ApiError.js";

type ValidationSource = "body" | "query" | "params";

/**
 * Validate req.body / req.query / req.params with Zod.
 * Express 5 exposes `query` (and sometimes `params`) as read-only getters —
 * validated output is stored on req.validatedQuery / req.validatedParams instead.
 */
const validateRequest =
  <T>(schema: ZodType<T>, source: ValidationSource = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const target = req[source];
    const result = schema.safeParse(target);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));

      return next(ApiError.validation("Validation failed", errors));
    }

    switch (source) {
      case "body":
        req.body = result.data;
        break;
      case "query":
        req.validatedQuery = result.data as Record<string, unknown>;
        break;
      case "params":
        req.validatedParams = result.data as Record<string, unknown>;
        break;
    }

    return next();
  };

export default validateRequest;
