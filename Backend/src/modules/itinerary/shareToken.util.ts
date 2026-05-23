import { nanoid } from "nanoid";
import type { Model } from "mongoose";

function generateShareToken(): string {
  return nanoid(12);
}

export async function generateUniqueShareToken(
  model: Model<unknown>,
  field = "shareToken",
  maxAttempts = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = generateShareToken();
    const existing = await model.exists({ [field]: token });
    if (!existing) {
      return token;
    }
  }

  throw new Error(
    "Unable to generate a unique share token after multiple attempts. Please try again."
  );
}

export default generateShareToken;
