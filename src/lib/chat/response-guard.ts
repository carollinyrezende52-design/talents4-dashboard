// src/lib/chat/response-guard.ts
// Validates the generated answer. Catches empty, hallucinated, or malformed output.

import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("response-guard");

const PLACEHOLDER_PATTERNS = [
  /\[INSERIR/i,
  /\[NOME DO CANDIDATO\]/i,
  /\[STATUS\]/i,
  /\[DATA\]/i,
  /PLACEHOLDER/i,
  /TODO:/i,
  /undefined/i,
  /null/i,
];

const MAX_ANSWER_LENGTH = 3000;
const MIN_ANSWER_LENGTH = 5;

export interface GuardResult {
  ok: boolean;
  answer: string;
  reason?: string;
}

const FALLBACK_ANSWERS = {
  empty: "Não consegui gerar uma resposta. Pode reformular sua pergunta?",
  tooLong: "A resposta gerada foi muito extensa. Por favor, tente uma pergunta mais específica.",
  placeholder: "Houve um problema ao montar a resposta. Tente novamente.",
  generic: "Não foi possível processar sua solicitação no momento. Tente novamente em instantes.",
};

export function guardResponse(rawAnswer: string): GuardResult {
  // 1. Empty or too short
  if (!rawAnswer || rawAnswer.trim().length < MIN_ANSWER_LENGTH) {
    log.warn("Guard: empty answer");
    return { ok: false, answer: FALLBACK_ANSWERS.empty, reason: "empty" };
  }

  // 2. Too long — truncate with notice
  if (rawAnswer.length > MAX_ANSWER_LENGTH) {
    log.warn("Guard: answer too long", { length: String(rawAnswer.length) });
    return {
      ok: true,
      answer: rawAnswer.slice(0, MAX_ANSWER_LENGTH) + "\n\n*(Resposta truncada — faça uma pergunta mais específica para mais detalhes.)*",
      reason: "truncated",
    };
  }

  // 3. Placeholder patterns
  const hasPlaceholder = PLACEHOLDER_PATTERNS.some((p) => p.test(rawAnswer));
  if (hasPlaceholder) {
    log.warn("Guard: placeholder detected in answer");
    return { ok: false, answer: FALLBACK_ANSWERS.placeholder, reason: "placeholder" };
  }

  return { ok: true, answer: rawAnswer.trim() };
}
