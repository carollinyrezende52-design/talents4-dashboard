// src/__tests__/data-resolver.test.ts

jest.mock("@/lib/data/query-handlers", () => ({
  getCandidateByName: jest.fn(),
  getCandidateStatus: jest.fn(),
  getCandidateDocuments: jest.fn(),
  getEmployerByName: jest.fn(),
  getMatchesByCandidate: jest.fn(),
  getMatchesByEmployer: jest.fn(),
}));

import { resolveData } from "@/lib/data/data-resolver";
import * as handlers from "@/lib/data/query-handlers";
import type { IntentClassification } from "@/types/chat";

const mock = handlers as jest.Mocked<typeof handlers>;

function makeClassification(
  overrides: Partial<IntentClassification>
): IntentClassification {
  return {
    intent: "candidate_status",
    needsDatabase: true,
    needsKnowledge: false,
    confidence: 0.9,
    entities: { candidateName: "Maria Silva" },
    action: "get_candidate_status",
    ambiguity: { hasAmbiguity: false },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── Cenário 2: Candidate found ───────────────────────────────────────────────
describe("Cenário 2 — Candidate status found", () => {
  it("should return structured context when candidate exists", async () => {
    mock.getCandidateStatus.mockResolvedValueOnce({
      found: true,
      ambiguous: false,
      candidate: {
        id: "abc",
        name: "Maria Silva",
        status: "Documentação pendente",
        substatus: "Aguardando certidão",
        nextStep: "Enviar certidão de antecedentes",
        missingDocuments: [],
        employerName: null,
        lastUpdate: "2024-01-10",
        germanLevel: "B1",
      },
    });

    const { context } = await resolveData(makeClassification({}));

    expect(context).toContain("Maria Silva");
    expect(context).toContain("Documentação pendente");
    expect(context).toContain("Enviar certidão");
  });
});

// ─── Cenário 3: Candidate documents ──────────────────────────────────────────
describe("Cenário 3 — Candidate documents", () => {
  it("should list missing documents in context", async () => {
    mock.getCandidateDocuments.mockResolvedValueOnce({
      found: true,
      ambiguous: false,
      candidate: {
        id: "abc",
        name: "Maria Silva",
        status: "Documentação pendente",
        substatus: null,
        nextStep: null,
        missingDocuments: ["Certidão de antecedentes", "Passaporte"],
        employerName: null,
        lastUpdate: null,
        germanLevel: null,
      },
    });

    const { context } = await resolveData(
      makeClassification({ action: "get_candidate_documents" })
    );

    expect(context).toContain("Certidão de antecedentes");
    expect(context).toContain("Passaporte");
  });
});

// ─── Cenário 5: Ambiguous name ────────────────────────────────────────────────
describe("Cenário 5 — Ambiguous candidate name", () => {
  it("should signal ambiguity without choosing arbitrarily", async () => {
    mock.getCandidateStatus.mockResolvedValueOnce({
      found: true,
      ambiguous: true,
      candidates: [
        { id: "1", name: "Carlos Silva", status: "Em triagem" },
        { id: "2", name: "Carlos Silva Junior", status: "Novo" },
      ],
    });

    const { context } = await resolveData(
      makeClassification({ entities: { candidateName: "Carlos Silva" } })
    );

    expect(context).toContain("AMBIGUIDADE");
    expect(context).toContain("Carlos Silva Junior");
  });
});

// ─── Cenário 6: Candidate not found ──────────────────────────────────────────
describe("Cenário 6 — Candidate not found", () => {
  it("should return not-found message, not invented data", async () => {
    mock.getCandidateStatus.mockResolvedValueOnce({ found: false, ambiguous: false });

    const { context } = await resolveData(
      makeClassification({ entities: { candidateName: "Fulano Inexistente" } })
    );

    expect(context).toContain("não encontrado");
  });
});

// ─── Cenário 9: Database failure ─────────────────────────────────────────────
describe("Cenário 9 — Database failure", () => {
  it("should return controlled error message without inventing data", async () => {
    mock.getCandidateStatus.mockRejectedValueOnce(new Error("Connection refused"));

    const { context, resolution } = await resolveData(makeClassification({}));

    expect(resolution).toBeNull();
    expect(context).toContain("não foi possível consultar");
  });
});

// ─── No database needed ───────────────────────────────────────────────────────
describe("No database action", () => {
  it("should return null context when needsDatabase is false", async () => {
    const { context } = await resolveData(
      makeClassification({ needsDatabase: false, action: "none" })
    );

    expect(context).toBeNull();
    expect(mock.getCandidateStatus).not.toHaveBeenCalled();
  });

  it("should return no-entity context when candidateName is missing", async () => {
    const { context } = await resolveData(
      makeClassification({ entities: {} })
    );

    expect(context).toContain("candidateName");
    expect(mock.getCandidateStatus).not.toHaveBeenCalled();
  });
});
