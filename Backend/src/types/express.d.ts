import type { IUserDocument } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      /** Set by validateRequest(..., "query") — do not assign to req.query in Express 5 */
      validatedQuery?: Record<string, unknown>;
      /** Set by validateRequest(..., "params") */
      validatedParams?: Record<string, unknown>;
    }
  }
}

export {};
