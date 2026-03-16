// src/lib/ai/classify-intent.ts
// Call 1: Classify user intent. Never responds to the user.

import { z } from "zod";
import { IntentClassificationSchema, IntentClassification } from "@/types/chat";
import { generateText } from "./gemini-client";
import { CLASSIFIER_SYSTEM_PROMPT, buildClassifierUserPrompt } from "./prompts";
import { stripMarkdownFences } from "@/lib/utils/sanitize";
import { makeLogger } from "@/lib/utils/logger";
import { GEMINI } from "@/lib/utils/constants";

const log = makeLogger("classify-intent");

// ─── Local fallback classifier ────────────────────────────────────────────────
// Used when Gemini call 1 fails. Keyword-based, limited but safe.

function localFallbackClassify(message: string): IntentClassification {
  const m = message.toLowerCase();

  const isCandidateQuery =
    /candidato|candidate|nome|sobrenome|status|etapa|fase|processo/.test(m);
  const isDocumentQuery = /document|certific|visto|passaport|diploma|faltando|pendente/.test(m);
  const isEmployerQuery = /empregador|empresa|hospital|cliente|parceiro/.test(m);
  const isFaqQuery = /como funciona|o que é|qual é o processo|regra|prazo|etapa geral/.test(m);

  if (isDocumentQuery && isCandidateQuery) {
    return {
      intent: "candidate_documents",
      needsDatabase: true,
      needsKnowledge: true,
      confidence: 0.5,
      entities: {},
      action: "get_candidate_documents",
      ambiguity: { hasAmbiguity: true, reason: "Fallback local — entidade não extraída" },
    };
  }
  if (isCandidateQuery) {
    return {
      intent: "candidate_status",
      needsDatabase: true,
      needsKnowledge: false,
      confidence: 0.5,
      entities: {},
      action: "get_candidate_status",
      ambiguity: { hasAmbiguity: true, reason: "Fallback local — entidade não extraída" },
    };
  }
  if (isEmployerQuery) {
    return {
      intent: "employer_lookup",
      needsDatabase: true,
      needsKnowledge: false,
      confidence: 0.5,
      entities: {},
      action: "get_employer_by_name",
      ambiguity: { hasAmbiguity: true, reason: "Fallback local — entidade não extraída" },
    };
  }
  if (isFaqQuery) {
    return {
      intent: "faq",
      needsDatabase: false,
      needsKnowledge: true,
      confidence: 0.6,
      entities: {},
      action: "none",
      ambiguity: { hasAmbiguity: false },
    };
  }

  return {
    intent: "out_of_scope",
    needsDatabase: false,
    needsKnowledge: false,
    confidence: 0.4,
    entities: {},
    action: "none",
    ambiguity: { hasAmbiguity: false },
  };
}

// ─── Main classifier ──────────────────────────────────────────────────────────

export async function classifyIntent(params: {
  userMessage: string;
  sessionSummary: string | null;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ classification: IntentClassification; usedFallback: boolean }> {
  const userPrompt = buildClassifierUserPrompt(params);

  try {
    const raw = await generateText({
      systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
      userPrompt,
      maxOutputTokens: GEMINI.CLASSIFIER_MAX_TOKENS,
      temperature: 0.1, // deterministic for classification
      label: "classifier",
    });

    const cleaned = stripMarkdownFences(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      log.warn("Classifier returned non-JSON — using local fallback", {
        raw: raw.slice(0, 200),
      });
      return {
        classification: localFallbackClassify(params.userMessage),
        usedFallback: true,
      };
    }

    const validated = IntentClassificationSchema.safeParse(parsed);
    if (!validated.success) {
      log.warn("Classifier schema validation failed — using local fallback", {
        errors: validated.error.issues.map((i) => i.message).join(", "),
      });
      return {
        classification: localFallbackClassify(params.userMessage),
        usedFallback: true,
      };
    }

    log.debug("Classification success", {
      intent: validated.data.intent,
      action: validated.data.action,
      confidence: String(validated.data.confidence),
    });

    return { classification: validated.data, usedFallback: false };
  } catch (err) {
    log.error("Classifier Gemini call failed — using local fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      classification: localFallbackClassify(params.userMessage),
      usedFallback: true,
    };
  }
}
