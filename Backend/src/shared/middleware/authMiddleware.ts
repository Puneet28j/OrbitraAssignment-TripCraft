import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import User from "../../models/User.js";
import ApiError from "../errors/ApiError.js";
import env from "../../config/env.js";

interface AccessTokenPayload {
  userId: string;
}

const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Access token is required");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw ApiError.unauthorized("Access token is required");
    }

    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET
    ) as AccessTokenPayload;

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw ApiError.unauthorized("User not found or has been deleted");
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    next(err);
  }
};

export default authMiddleware;
