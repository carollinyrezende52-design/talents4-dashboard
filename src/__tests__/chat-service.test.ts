// src/__tests__/chat-service.test.ts
// Integration-level tests for the pipeline. All external I/O is mocked.

jest.mock("@/lib/ai/gemini-client", () => ({ generateText: jest.fn() }));
jest.mock("@/lib/data/query-handlers", () => ({
  getCandidateStatus: jest.fn(),
  getCandidateByName: jest.fn(),
  getCandidateDocuments: jest.fn(),
  getEmployerByName: jest.fn(),
  getMatchesByCandidate: jest.fn(),
  getMatchesByEmployer: jest.fn(),
}));
jest.mock("@/lib/chat/session-service", () => ({
  getOrCreateSession: jest.fn(),
  getRecentMessages: jest.fn(),
  countSessionMessages: jest.fn(),
  persistMessages: jest.fn(),
  updateSessionSummary: jest.fn(),
}));

import { processMessage } from "@/lib/chat/chat-service";
import { generateText } from "@/lib/ai/gemini-client";
import * as sessionSvc from "@/lib/chat/session-service";
import * as handlers from "@/lib/data/query-handlers";

const mockGenerate = generateText as jest.MockedFunction<typeof generateText>;
const mockSession = sessionSvc as jest.Mocked<typeof sessionSvc>;
const mockHandlers = handlers as jest.Mocked<typeof handlers>;

const SESSION_DEFAULTS = {
  getOrCreateSession: { id: "sess_test", user_id: null, title: "Test", summary: null, created_at: "", updated_at: "" },
  getRecentMessages: [],
  countSessionMessages: 2,
  persistMessages: "msg_123",
};

function setupSessionMocks() {
  mockSession.getOrCreateSession.mockResolvedValue(SESSION_DEFAULTS.getOrCreateSession);
  mockSession.getRecentMessages.mockResolvedValue(SESSION_DEFAULTS.getRecentMessages);
  mockSession.countSessionMessages.mockResolvedValue(SESSION_DEFAULTS.countSessionMessages);
  mockSession.persistMessages.mockResolvedValue(SESSION_DEFAULTS.persistMessages);
  mockSession.updateSessionSummary.mockResolvedValue(undefined);
}

const CLASSIFY_FAQ = JSON.stringify({
  intent: "faq", needsDatabase: false, needsKnowledge: true,
  confidence: 0.95, entities: {}, action: "none",
  ambiguity: { hasAmbiguity: false },
});

const CLASSIFY_STATUS = JSON.stringify({
  intent: "candidate_status", needsDatabase: true, needsKnowledge: false,
  confidence: 0.92, entities: { candidateName: "Maria Silva" },
  action: "get_candidate_status", ambiguity: { hasAmbiguity: false },
});

const CLASSIFY_MIXED = JSON.stringify({
  intent: "mixed", needsDatabase: true, needsKnowledge: true,
  confidence: 0.88, entities: { candidateName: "João Pereira" },
  action: "get_candidate_documents", ambiguity: { hasAmbiguity: false },
});

beforeEach(() => {
  jest.clearAllMocks();
  setupSessionMocks();
});

// ─── Cenário 1 ────────────────────────────────────────────────────────────────
describe("Cenário 1 — Institutional FAQ", () => {
  it("should not query DB and should use knowledge base", async () => {
    mockGenerate
      .mockResolvedValueOnce(CLASSIFY_FAQ) // classifier
      .mockResolvedValueOnce("A Talents4 é uma empresa de recrutamento internacional."); // answer

    const result = await processMessage({ sessionId: "sess_test", message: "o que é a talents4?" });

    expect(result.ok).toBe(true);
    expect(result.meta.usedKnowledge).toBe(true);
    expect(result.meta.usedDatabase).toBe(false);
    expect(result.answer).toContain("Talents4");
    expect(mockHandlers.getCandidateStatus).not.toHaveBeenCalled();
  });
});

// ─── Cenário 2 ────────────────────────────────────────────────────────────────
describe("Cenário 2 — Candidate status", () => {
  it("should classify, query DB, and return real status", async () => {
    mockHandlers.getCandidateStatus.mockResolvedValueOnce({
      found: true, ambiguous: false,
      candidate: {
        id: "abc", name: "Maria Silva", status: "Documentação pendente",
        substatus: null, nextStep: "Enviar passaporte", missingDocuments: [],
        employerName: null, lastUpdate: null, germanLevel: "B1",
      },
    });

    mockGenerate
      .mockResolvedValueOnce(CLASSIFY_STATUS)
      .mockResolvedValueOnce("Maria Silva está com documentação pendente. Próximo passo: enviar passaporte.");

    const result = await processMessage({ sessionId: "sess_test", message: "qual o status da Maria Silva?" });

    expect(result.ok).toBe(true);
    expect(result.meta.usedDatabase).toBe(true);
    expect(result.meta.intent).toBe("candidate_status");
    expect(result.answer).toContain("Maria Silva");
    expect(mockHandlers.getCandidateStatus).toHaveBeenCalledWith("Maria Silva");
  });
});

// ─── Cenário 4 ────────────────────────────────────────────────────────────────
describe("Cenário 4 — Hybrid question", () => {
  it("should use both knowledge base and database", async () => {
    mockHandlers.getCandidateDocuments.mockResolvedValueOnce({
      found: true, ambiguous: false,
      candidate: {
        id: "def", name: "João Pereira", status: "Documentação pendente",
        substatus: null, nextStep: null, missingDocuments: ["Certidão de antecedentes"],
        employerName: null, lastUpdate: null, germanLevel: null,
      },
    });

    mockGenerate
      .mockResolvedValueOnce(CLASSIFY_MIXED)
      .mockResolvedValueOnce("João tem 1 documento pendente. Segundo as regras do processo, isso precisa ser resolvido antes da entrevista.");

    const result = await processMessage({
      sessionId: "sess_test",
      message: "quais documentos faltam pro João e o que acontece se não enviar?",
    });

    expect(result.ok).toBe(true);
    expect(result.meta.usedKnowledge).toBe(true);
    expect(result.meta.usedDatabase).toBe(true);
  });
});

// ─── Cenário 9 ────────────────────────────────────────────────────────────────
describe("Cenário 9 — Database failure", () => {
  it("should return controlled response without inventing data", async () => {
    mockHandlers.getCandidateStatus.mockRejectedValueOnce(new Error("DB connection refused"));

    mockGenerate
      .mockResolvedValueOnce(CLASSIFY_STATUS)
      .mockResolvedValueOnce("Não foi possível consultar os dados no momento. Por favor, tente novamente.");

    const result = await processMessage({ sessionId: "sess_test", message: "status da Maria" });

    expect(result.ok).toBe(true);
    expect(result.answer).toBeTruthy();
    // Must not invent status values
    expect(result.answer).not.toMatch(/Aprovado|Contratado|Triagem/);
  });
});

// ─── Cenário 10 ───────────────────────────────────────────────────────────────
describe("Cenário 10 — Long history summarisation trigger", () => {
  it("should trigger summarisation when message count exceeds threshold", async () => {
    mockSession.countSessionMessages.mockResolvedValue(12); // hits SUMMARISE_AFTER
    mockSession.getRecentMessages.mockResolvedValue([
      { role: "user", content: "primeira mensagem" },
      { role: "assistant", content: "resposta" },
    ]);

    mockGenerate
      .mockResolvedValueOnce(CLASSIFY_FAQ)         // classifier
      .mockResolvedValueOnce("Resposta normal.")   // final answer
      .mockResolvedValueOnce("Resumo da sessão."); // summariser

    await processMessage({ sessionId: "sess_test", message: "mais uma pergunta" });

    expect(mockSession.updateSessionSummary).toHaveBeenCalled();
  });
});
