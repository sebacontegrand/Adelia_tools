import { GoogleGenerativeAI } from "@google/generative-ai";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function isGeminiRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("429") || msg.toLowerCase().includes("resource exhausted");
}

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    isGeminiRateLimitError(error) ||
    msg.includes("503") ||
    msg.toLowerCase().includes("timeout") ||
    msg.toLowerCase().includes("temporar")
  );
}

let nextAllowedAtMs = 0;

async function enforceMinDelay(minDelayMs: number) {
  const now = Date.now();
  if (now < nextAllowedAtMs) {
    await sleep(nextAllowedAtMs - now);
  }
  nextAllowedAtMs = Math.max(nextAllowedAtMs, Date.now()) + minDelayMs;
}

export async function geminiGenerateText(options: {
  apiKey: string;
  model: string;
  parts: unknown;
  minDelayMs?: number;
  maxRetries?: number;
}) {
  const minDelayMs = options.minDelayMs ?? Number(process.env.GEMINI_MIN_DELAY_MS || "1200");
  const maxRetries = options.maxRetries ?? 5;

  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({ model: options.model });
  const input = options.parts as Parameters<typeof model.generateContent>[0];

  let attempt = 0;
  // One global throttle per runtime instance
  await enforceMinDelay(minDelayMs);

  // Retry loop
  while (true) {
    try {
      const result = await model.generateContent(input);
      return result.response.text();
    } catch (error) {
      attempt++;
      const retryable = isRetryableError(error);
      if (!retryable || attempt > maxRetries) {
        throw error;
      }

      const base = Math.min(30_000, 750 * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 400);
      const backoff = base + jitter;
      console.warn(
        `[Gemini] Retry ${attempt}/${maxRetries} in ${backoff}ms (${isGeminiRateLimitError(error) ? "rate_limit" : "transient"})`
      );
      await sleep(backoff);
      await enforceMinDelay(minDelayMs);
    }
  }
}
