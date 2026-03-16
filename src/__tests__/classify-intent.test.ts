// src/__tests__/classify-intent.test.ts
// Tests for the intent classifier, including fallback behaviour.

jest.mock("@/lib/ai/gemini-client", () => ({
  generateText: jest.fn(),
}));

import { classifyIntent } from "@/lib/ai/classify-intent";
import { generateText } from "@/lib/ai/gemini-client";

const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

const baseParams = {
  userMessage: "",
  sessionSummary: null,
  recentMessages: [] as Array<{ role: "user" | "assistant"; content: string }>,
};

// ─── Cenário 1: FAQ intent ────────────────────────────────────────────────────
describe("Cenário 1 — FAQ classification", () => {
  it("should classify FAQ correctly", async () => {
    mockGenerateText.mockResolvedValueOnce(
      JSON.stringify({
        intent: "faq",
        needsDatabase: false,
        needsKnowledge: true,
        confidence: 0.95,
        entities: {},
        action: "none",
        ambiguity: { hasAmbiguity: false },
      })
    );

    const { classification, usedFallback } = await classifyIntent({
      ...baseParams,
      userMessage: "como funciona o processo de recrutamento?",
    });

    expect(classification.intent).toBe("faq");
    expect(classification.needsDatabase).toBe(false);
    expect(classification.needsKnowledge).toBe(true);
    expect(usedFallback).toBe(false);
  });
});

// ─── Cenário 2: Candidate status ─────────────────────────────────────────────
describe("Cenário 2 — Candidate status classification", () => {
  it("should classify candidate_status and extract name", async () => {
    mockGenerateText.mockResolvedValueOnce(
      JSON.stringify({
        intent: "candidate_status",
        needsDatabase: true,
        needsKnowledge: false,
        confidence: 0.92,
        entities: { candidateName: "Maria Silva" },
        action: "get_candidate_status",
        ambiguity: { hasAmbiguity: false },
      })
    );

    const { classification } = await classifyIntent({
      ...baseParams,
      userMessage: "qual o status da Maria Silva?",
    });

    expect(classification.intent).toBe("candidate_status");
    expect(classification.needsDatabase).toBe(true);
    expect(classification.action).toBe("get_candidate_status");
    expect(classification.entities.candidateName).toBe("Maria Silva");
  });
});

// ─── Cenário 3: Candidate documents ──────────────────────────────────────────
describe("Cenário 3 — Candidate documents classification", () => {
  it("should classify candidate_documents", async () => {
    mockGenerateText.mockResolvedValueOnce(
      JSON.stringify({
        intent: "candidate_documents",
        needsDatabase: true,
        needsKnowledge: true,
        confidence: 0.88,
        entities: { candidateName: "João Pereira" },
        action: "get_candidate_documents",
        ambiguity: { hasAmbiguity: false },
      })
    );

    const { classification } = await classifyIntent({
      ...baseParams,
      userMessage: "quais documentos faltam para o João Pereira?",
    });

    expect(classification.intent).toBe("candidate_documents");
    expect(classification.action).toBe("get_candidate_documents");
    expect(classification.needsKnowledge).toBe(true);
  });
});

// ─── Cenário 5: Ambiguous name ────────────────────────────────────────────────
describe("Cenário 5 — Ambiguous entity", () => {
  it("should signal ambiguity for partial name", async () => {
    mockGenerateText.mockResolvedValueOnce(
      JSON.stringify({
        intent: "candidate_status",
        needsDatabase: true,
        needsKnowledge: false,
        confidence: 0.7,
        entities: { candidateName: "Carlos" },
        action: "get_candidate_status",
        ambiguity: { hasAmbiguity: true, reason: "Nome parcial — múltiplos candidatos possíveis" },
      })
    );

    const { classification } = await classifyIntent({
      ...baseParams,
      userMessage: "como está o Carlos?",
    });

    expect(classification.ambiguity.hasAmbiguity).toBe(true);
    expect(classification.ambiguity.reason).toBeTruthy();
  });
});

// ─── Cenário 7: Classifier Gemini fails → local fallback ─────────────────────
describe("Cenário 7 — Classifier Gemini failure → local fallback", () => {
  it("should use local fallback when Gemini throws", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("Gemini timeout"));

    const { classification, usedFallback } = await classifyIntent({
      ...baseParams,
      userMessage: "qual o status do candidato?",
    });

    expect(usedFallback).toBe(true);
    expect(classification.intent).toBeDefined();
    expect(classification.action).toBeDefined();
  });

  it("should use local fallback when Gemini returns invalid JSON", async () => {
    mockGenerateText.mockResolvedValueOnce("not json at all {{{}}}");

    const { usedFallback } = await classifyIntent({
      ...baseParams,
      userMessage: "como funciona o processo?",
    });

    expect(usedFallback).toBe(true);
  });

  it("should use local fallback when Gemini returns non-conforming schema", async () => {
    mockGenerateText.mockResolvedValueOnce(
      JSON.stringify({ intent: "UNKNOWN_INTENT", foo: "bar" })
    );

    const { usedFallback } = await classifyIntent({
      ...baseParams,
      userMessage: "alguma coisa",
    });

    expect(usedFallback).toBe(true);
  });
});
