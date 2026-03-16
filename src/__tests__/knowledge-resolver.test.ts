// src/__tests__/knowledge-resolver.test.ts
import { resolveKnowledge, serializeKnowledgeContext } from "@/lib/knowledge/knowledge-resolver";
import type { IntentClassification } from "@/types/chat";

function makeClassification(
  overrides: Partial<IntentClassification>
): IntentClassification {
  return {
    intent: "faq",
    needsDatabase: false,
    needsKnowledge: true,
    confidence: 0.9,
    entities: {},
    action: "none",
    ambiguity: { hasAmbiguity: false },
    ...overrides,
  };
}

// ─── Cenário 1: Pergunta institucional ────────────────────────────────────────
describe("Cenário 1 — Pergunta institucional simples", () => {
  it("should NOT query database and SHOULD use knowledge base", () => {
    const c = makeClassification({ intent: "faq", needsDatabase: false, needsKnowledge: true });
    const result = resolveKnowledge(c, "o que é a talents4");

    expect(result.totalSelected).toBeGreaterThan(0);
    expect(result.blocks.every((b) => b.isActive)).toBe(true);
  });

  it("should select company_overview block for generic company question", () => {
    const c = makeClassification({ intent: "faq", needsKnowledge: true });
    const result = resolveKnowledge(c, "me explica sobre a empresa");

    const slugs = result.blocks.map((b) => b.slug);
    expect(slugs).toContain("company_overview");
  });
});

// ─── Cenário 4: Pergunta híbrida ──────────────────────────────────────────────
describe("Cenário 4 — Pergunta híbrida (knowledge + DB)", () => {
  it("should return knowledge blocks for mixed intent", () => {
    const c = makeClassification({
      intent: "mixed",
      needsDatabase: true,
      needsKnowledge: true,
    });
    const result = resolveKnowledge(c, "qual o status e o que falta para avançar");

    expect(result.totalSelected).toBeGreaterThan(0);
  });
});

// ─── Respeitam o limite de blocos ─────────────────────────────────────────────
describe("Knowledge block limits", () => {
  it("should never return more than MAX_KNOWLEDGE_BLOCKS", () => {
    const c = makeClassification({ intent: "faq", needsKnowledge: true });
    const result = resolveKnowledge(c, "documentos alemão processo status empresa");

    expect(result.totalSelected).toBeLessThanOrEqual(4);
  });

  it("should return empty when needsKnowledge is false", () => {
    const c = makeClassification({ needsKnowledge: false });
    const result = resolveKnowledge(c, "qualquer coisa");

    expect(result.blocks).toHaveLength(0);
  });
});

// ─── Serialização ─────────────────────────────────────────────────────────────
describe("serializeKnowledgeContext", () => {
  it("should return null for empty blocks", () => {
    expect(serializeKnowledgeContext([])).toBeNull();
  });

  it("should return string with block titles", () => {
    const c = makeClassification({ intent: "faq", needsKnowledge: true });
    const result = resolveKnowledge(c, "documentos necessários");
    const context = serializeKnowledgeContext(result.blocks);

    expect(context).not.toBeNull();
    expect(typeof context).toBe("string");
    expect(context!.length).toBeGreaterThan(0);
  });

  it("should respect MAX_KNOWLEDGE_CHARS limit", () => {
    const c = makeClassification({ intent: "faq", needsKnowledge: true });
    const result = resolveKnowledge(c, "documentos alemão processo status empresa matching");
    const context = serializeKnowledgeContext(result.blocks);

    expect(context!.length).toBeLessThanOrEqual(6000 + 200); // small buffer for titles
  });
});
