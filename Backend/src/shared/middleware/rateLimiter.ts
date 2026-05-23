import type { RequestHandler } from "express";

const passThrough: RequestHandler = (_req, _res, next) => next();

export const authLimiter = passThrough;
export const generalLimiter = passThrough;
export const uploadLimiter = passThrough;
