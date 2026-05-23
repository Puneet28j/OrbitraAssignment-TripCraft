import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { CookieOptions, Response } from "express";
import env from "../../config/env.js";
import RefreshToken from "../../models/RefreshToken.js";
import type { Types } from "mongoose";

export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(userId: Types.ObjectId | string): string {
  return jwt.sign({ userId: String(userId) }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

export function generateRefreshToken(userId: Types.ObjectId | string): string {
  return jwt.sign({ userId: String(userId) }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

function getRefreshExpiryDate(token: string): Date {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (decoded?.exp) {
    return new Date(decoded.exp * 1000);
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export async function persistRefreshToken(
  userId: Types.ObjectId | string,
  refreshToken: string
): Promise<void> {
  await RefreshToken.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshExpiryDate(refreshToken),
  });
}

export async function verifyStoredRefreshToken(
  userId: Types.ObjectId | string,
  refreshToken: string
): Promise<boolean> {
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await RefreshToken.findOne({
    userId,
    tokenHash,
    expiresAt: { $gt: new Date() },
  });
  return Boolean(stored);
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);
  await RefreshToken.deleteOne({ tokenHash });
}

export async function revokeAllRefreshTokens(
  userId: Types.ObjectId | string
): Promise<void> {
  await RefreshToken.deleteMany({ userId });
}

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

export async function rotateRefreshToken(
  userId: Types.ObjectId | string,
  oldRefreshToken: string,
  res: Response
): Promise<string> {
  await revokeRefreshToken(oldRefreshToken);
  const newRefreshToken = generateRefreshToken(userId);
  await persistRefreshToken(userId, newRefreshToken);
  setRefreshCookie(res, newRefreshToken);
  return newRefreshToken;
}
