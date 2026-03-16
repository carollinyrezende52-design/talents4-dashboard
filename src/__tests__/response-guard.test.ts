// src/__tests__/response-guard.test.ts
import { guardResponse } from "@/lib/chat/response-guard";

describe("guardResponse", () => {
  it("should return ok:false for empty string", () => {
    const result = guardResponse("");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("empty");
  });

  it("should return ok:false for whitespace-only string", () => {
    const result = guardResponse("   ");
    expect(result.ok).toBe(false);
  });

  it("should return ok:true for valid answer", () => {
    const result = guardResponse("O candidato está na fase de triagem.");
    expect(result.ok).toBe(true);
    expect(result.answer).toBe("O candidato está na fase de triagem.");
  });

  it("should detect placeholder [INSERIR", () => {
    const result = guardResponse("O candidato [INSERIR NOME] está em triagem.");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("placeholder");
  });

  it("should detect undefined as placeholder", () => {
    const result = guardResponse("Status: undefined");
    expect(result.ok).toBe(false);
  });

  it("should truncate overly long answers", () => {
    const long = "a".repeat(4000);
    const result = guardResponse(long);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("truncated");
    expect(result.answer.length).toBeLessThan(4000);
    expect(result.answer).toContain("truncada");
  });
});

// ─── Cenário 8: Final answer Gemini failure → template fallback ───────────────
jest.mock("@/lib/ai/gemini-client", () => ({
  generateText: jest.fn(),
}));

import { generateFinalAnswer } from "@/lib/ai/generate-final-answer";
import { generateText } from "@/lib/ai/gemini-client";

const mockGenerate = generateText as jest.MockedFunction<typeof generateText>;

describe("Cenário 8 — Final answer Gemini failure → template fallback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should use template fallback when Gemini throws", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("Gemini unavailable"));

    const { answer, usedFallback } = await generateFinalAnswer({
      userMessage: "qual o status do João?",
      sessionSummary: null,
      recentMessages: [],
      knowledgeContext: null,
      dataContext: "[DADOS DO CANDIDATO]\nNome: João\nStatus: Aprovado",
      ambiguityDetected: false,
    });

    expect(usedFallback).toBe(true);
    expect(answer).toContain("João");
    expect(answer).toContain("Aprovado");
  });

  it("should use fallback message when Gemini returns empty string", async () => {
    mockGenerate.mockResolvedValueOnce("   ");

    const { usedFallback } = await generateFinalAnswer({
      userMessage: "qualquer coisa",
      sessionSummary: null,
      recentMessages: [],
      knowledgeContext: null,
      dataContext: null,
      ambiguityDetected: false,
    });

    expect(usedFallback).toBe(true);
  });
});
