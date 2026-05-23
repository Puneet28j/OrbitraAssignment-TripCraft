import type { Request, Response, NextFunction } from "express";

const passThrough = (_req: Request, _res: Response, next: NextFunction) => next();

export const authLimiter = passThrough;
export const generalLimiter = passThrough;
export const uploadLimiter = passThrough;
