import env from "../../config/env.js";
import ApiError from "../errors/ApiError.js";
import logger from "../logger.js";

/* ── Constants ─────────────────────────────────────── */

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK_MODELS = [
  "openrouter/free",
  "deepseek/deepseek-v4-flash:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3:free",
];
const MAX_RETRIES_PER_MODEL = 2;
const INITIAL_BACKOFF_MS = 2_000;

/* ── Types ─────────────────────────────────────────── */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChoice {
  message: { role: string; content: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: { message: string; code?: number };
}

/* ── Helpers ───────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ordered list of models to attempt (primary from env, then fallbacks). */
export function getModelChain(): string[] {
  const primary = env.OPENROUTER_MODEL?.trim();
  const chain = primary
    ? [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)]
    : [...FALLBACK_MODELS];
  return [...new Set(chain)];
}

export function isTransientError(error: unknown): boolean {
  const msg = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("rate limit") ||
    msg.includes("try again") ||
    msg.includes("timed out") ||
    msg.includes("timeout")
  );
}

export function mapAIError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isTransientError(error)) {
    return ApiError.serviceUnavailable(
      "The AI service is temporarily busy. Please wait a moment and try again."
    );
  }

  const detail = error instanceof Error ? error.message : String(error);
  logger.error({ err: detail }, "Non-retryable AI error");
  return ApiError.internal("AI request failed. Please try again later.");
}

/* ── Core: Call OpenRouter ─────────────────────────── */

export interface CallOpenRouterOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Send a chat-completion request to OpenRouter.
 * Returns the raw text content from the first choice.
 */
export async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  options?: CallOpenRouterOptions
): Promise<string> {
  const body: Record<string, unknown> = { model, messages };
  if (options?.maxTokens != null) {
    body.max_tokens = options.maxTokens;
  }
  if (options?.temperature != null) {
    body.temperature = options.temperature;
  }

  logger.info({ model }, "Calling OpenRouter");

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.CLIENT_URL,
      "X-Title": "Orbitra",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    logger.error(
      { status: res.status, body: errorBody, model },
      "OpenRouter HTTP error"
    );
    throw new Error(`OpenRouter ${res.status}: ${errorBody}`);
  }

  const data = (await res.json()) as OpenRouterResponse;

  if (data.error) {
    logger.error({ error: data.error, model }, "OpenRouter API error");
    throw new Error(`OpenRouter API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    logger.error({ data, model }, "OpenRouter returned empty response");
    throw new Error("OpenRouter returned an empty response");
  }

  return content;
}

/* ── Resilience: Retry + Fallback ──────────────────── */

/**
 * Retry with exponential backoff per model, then fall through to the next.
 */
export interface AIResilienceOptions {
  label?: string;
  /** Cap how many models to try (default: full chain). */
  maxModels?: number;
  /** Retries per model on transient errors (default: MAX_RETRIES_PER_MODEL). */
  maxRetriesPerModel?: number;
}

export async function withAIResilience<T>(
  operation: (modelName: string) => Promise<T>,
  options?: AIResilienceOptions
): Promise<T> {
  const models = getModelChain().slice(0, options?.maxModels ?? undefined);
  const retriesPerModel = options?.maxRetriesPerModel ?? MAX_RETRIES_PER_MODEL;
  let lastError: unknown;

  for (const modelName of models) {
    for (let attempt = 0; attempt < retriesPerModel; attempt++) {
      try {
        if (attempt > 0 || modelName !== models[0]) {
          logger.info(
            { modelName, attempt: attempt + 1, label: options?.label },
            "AI request attempt"
          );
        }
        return await operation(modelName);
      } catch (error) {
        lastError = error;

        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn(
          {
            modelName,
            attempt: attempt + 1,
            error: errMsg,
            label: options?.label,
          },
          "AI request failed"
        );

        const canRetry =
          isTransientError(error) && attempt < retriesPerModel - 1;

        if (!canRetry) break;

        const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
        logger.warn(
          { modelName, delayMs: delay, label: options?.label },
          "Retrying after backoff"
        );
        await sleep(delay);
      }
    }

    if (models.indexOf(modelName) < models.length - 1) {
      logger.warn(
        { failedModel: modelName, label: options?.label },
        "Switching to fallback AI model"
      );
    }
  }

  throw mapAIError(lastError);
}
