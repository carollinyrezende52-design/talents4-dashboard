// src/lib/ai/gemini-client.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiError } from "@/lib/utils/errors";
import { GEMINI } from "@/lib/utils/constants";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("gemini-client");

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (_client) return _client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY not configured");
  _client = new GoogleGenerativeAI(key);
  return _client;
}

interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  label?: string; // for logging
}

/**
 * Core generation wrapper with timeout and error handling.
 * All callers go through here — never instantiate the model directly elsewhere.
 */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const label = opts.label ?? "generate";
  const t0 = Date.now();

  log.debug(`[${label}] Starting generation`);

  const model = getClient().getGenerativeModel({
    model: GEMINI.MODEL,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? GEMINI.ANSWER_MAX_TOKENS,
      temperature: opts.temperature ?? 0.3,
      responseMimeType: "text/plain",
    },
  });

  const timeoutMs = GEMINI.TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
    log.warn(`[${label}] Timeout after ${timeoutMs}ms`);
  }, timeoutMs);

  try {
    const resultPromise = model.generateContent(opts.userPrompt);

    // Race against timeout
    const result = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new GeminiError(`Gemini timeout after ${timeoutMs}ms`))
        );
      }),
    ]);

    const text = result.response.text();
    log.debug(`[${label}] Completed in ${Date.now() - t0}ms`, {
      chars: String(text.length),
    });
    return text;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[${label}] Failed`, { error: msg });
    throw new GeminiError(`Gemini call failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}
