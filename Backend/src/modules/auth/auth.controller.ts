import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import User from "../../models/User.js";
import ApiResponse from "../../shared/http/ApiResponse.js";
import ApiError from "../../shared/errors/ApiError.js";
import asyncHandler from "../../shared/middleware/asyncHandler.js";
import {
  clearRefreshCookie,
  generateAccessToken,
  generateRefreshToken,
  persistRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshCookie,
  verifyStoredRefreshToken,
} from "./token.util.js";
import env from "../../config/env.js";

interface RefreshTokenPayload {
  userId: string;
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const user = await User.create({ name, email, password });

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  await persistRefreshToken(user._id, refreshToken);
  setRefreshCookie(res, refreshToken);

  ApiResponse.created("Account created successfully", {
    user: user.toPublicJSON(),
    accessToken,
  }).send(res);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  await persistRefreshToken(user._id, refreshToken);
  setRefreshCookie(res, refreshToken);

  ApiResponse.ok("Logged in successfully", {
    user: user.toPublicJSON(),
    accessToken,
  }).send(res);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  clearRefreshCookie(res);
  ApiResponse.ok("Logged out successfully").send(res);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    throw ApiError.unauthorized("Refresh token not found");
  }

  let decoded: RefreshTokenPayload;
  try {
    decoded = jwt.verify(
      refreshToken,
      env.JWT_REFRESH_SECRET
    ) as RefreshTokenPayload;
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized("User not found");
  }

  const isValid = await verifyStoredRefreshToken(user._id, refreshToken);
  if (!isValid) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const accessToken = generateAccessToken(user._id);
  await rotateRefreshToken(user._id, refreshToken, res);

  ApiResponse.ok("Token refreshed successfully", {
    user: user.toPublicJSON(),
    accessToken,
  }).send(res);
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized("Not authenticated");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  ApiResponse.ok("User profile retrieved", {
    user: user.toPublicJSON(),
  }).send(res);
});
