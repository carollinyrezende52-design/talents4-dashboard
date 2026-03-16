// src/lib/ai/generate-final-answer.ts
// Call 2: Generate user-facing response based on resolved context.

import { generateText } from "./gemini-client";
import { ANSWER_SYSTEM_PROMPT, buildAnswerUserPrompt } from "./prompts";
import { makeLogger } from "@/lib/utils/logger";
import { GEMINI } from "@/lib/utils/constants";

const log = makeLogger("generate-final-answer");

interface AnswerParams {
  userMessage: string;
  sessionSummary: string | null;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  knowledgeContext: string | null;
  dataContext: string | null;
  ambiguityDetected: boolean;
}

export async function generateFinalAnswer(
  params: AnswerParams
): Promise<{ answer: string; usedFallback: boolean }> {
  const userPrompt = buildAnswerUserPrompt(params);

  try {
    const answer = await generateText({
      systemPrompt: ANSWER_SYSTEM_PROMPT,
      userPrompt,
      maxOutputTokens: GEMINI.ANSWER_MAX_TOKENS,
      temperature: 0.4,
      label: "final-answer",
    });

    if (!answer.trim()) {
      log.warn("Gemini returned empty answer — using template fallback");
      return {
        answer: buildTemplateFallback(params),
        usedFallback: true,
      };
    }

    return { answer: answer.trim(), usedFallback: false };
  } catch (err) {
    log.error("Final answer Gemini call failed — using template fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      answer: buildTemplateFallback(params),
      usedFallback: true,
    };
  }
}

// ─── Template fallback ────────────────────────────────────────────────────────
// Used when Gemini call 2 fails. Assembles readable response from structured data.

function buildTemplateFallback(params: AnswerParams): string {
  const parts: string[] = [];

  if (params.dataContext) {
    parts.push(`**Dados encontrados:**\n${params.dataContext}`);
  }

  if (params.knowledgeContext) {
    parts.push(`**Informações relevantes:**\n${params.knowledgeContext}`);
  }

  if (parts.length === 0) {
    if (params.ambiguityDetected) {
      return "Não consegui identificar exatamente o que você está buscando. Poderia ser mais específico? Por exemplo, informe o nome completo do candidato ou empregador.";
    }
    return "No momento não consigo processar sua solicitação. Por favor, tente novamente em alguns instantes.";
  }

  return parts.join("\n\n");
}
