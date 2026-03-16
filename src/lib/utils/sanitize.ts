// src/lib/utils/sanitize.ts

/**
 * Trim and remove control characters from user input.
 * Does NOT strip HTML — that's the renderer's job.
 */
export function sanitizeMessage(raw: string): string {
  return raw
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, 4000);
}

/** Strip markdown fences that Gemini sometimes adds around JSON */
export function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}
