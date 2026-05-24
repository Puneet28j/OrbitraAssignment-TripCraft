import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .url("MONGODB_URI must be a valid URL"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  CLOUDINARY_CLOUD_NAME: z
    .string()
    .min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z
    .string()
    .min(1, "CLOUDINARY_API_SECRET is required"),

  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  /** Primary model; fallbacks used automatically on 503/429 */
  OPENROUTER_MODEL: z.string().optional(),

  /** Parallel document text extractions (PDF + OCR) */
  EXTRACTION_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),

  /** fast = 1 OCR pass (quicker uploads); robust = multi-pass OCR (slower, best accuracy) */
  EXTRACTION_MODE: z.enum(["fast", "robust"]).default("fast"),

  /** Max tokens for itinerary JSON output (lower = faster on free models) */
  OPENROUTER_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(1024)
    .max(16384)
    .default(4200),

  /** How many OpenRouter models to try before failing (1 = fastest on free tier) */
  OPENROUTER_MAX_MODELS: z.coerce.number().int().min(1).max(5).default(1),

  CLIENT_URL: z
    .string()
    .url("CLIENT_URL must be a valid URL")
    .default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("");
  console.error("══════════════════════════════════════════════════════");
  console.error("  ❌  ENVIRONMENT VARIABLE VALIDATION FAILED");
  console.error("══════════════════════════════════════════════════════");
  console.error("");

  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".") || "unknown";
    console.error(`  • ${path}: ${issue.message}`);
  }

  console.error("");
  console.error("  → Check your .env file against .env.example");
  console.error("══════════════════════════════════════════════════════");
  console.error("");
  process.exit(1);
}

const env = Object.freeze(parsed.data!);

export type Env = typeof env;
export default env;
