// src/lib/knowledge/knowledge-resolver.ts
// Selects relevant knowledge blocks using keyword + category scoring.
// No embeddings needed at this stage.

import type { IntentClassification } from "@/types/chat";
import type { KnowledgeBlock, KnowledgeCategory, KnowledgeResolutionResult } from "@/types/knowledge";
import { KNOWLEDGE_BLOCKS } from "./knowledge-index";
import { CHAT } from "@/lib/utils/constants";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("knowledge-resolver");

// Intent → preferred categories mapping
const INTENT_CATEGORIES: Record<string, KnowledgeCategory[]> = {
  faq: ["company_overview", "faq_application_status", "faq_documents", "faq_language_course"],
  process_rule: ["process_rules", "compliance_rules", "faq_application_status"],
  candidate_documents: ["faq_documents", "process_rules", "compliance_rules"],
  candidate_status: ["faq_application_status", "process_rules"],
  employer_lookup: ["employer_process_notes", "matching_logic"],
  match_lookup: ["matching_logic", "employer_process_notes"],
  mixed: ["process_rules", "faq_application_status", "faq_documents", "matching_logic"],
  candidate_lookup: [],
  out_of_scope: [],
};

function scoreBlock(
  block: KnowledgeBlock,
  intent: string,
  message: string,
  preferredCategories: KnowledgeCategory[]
): number {
  let score = 0;
  const msgLower = message.toLowerCase();

  // Category match
  if (preferredCategories.includes(block.category)) score += 10;

  // Priority boost (priority 1 = most important)
  score += (4 - block.priority) * 3;

  // Keyword match
  const keywordHits = block.keywords.filter((kw) =>
    msgLower.includes(kw.toLowerCase())
  ).length;
  score += keywordHits * 5;

  // Title word match
  const titleWords = block.title.toLowerCase().split(/\s+/);
  const titleHits = titleWords.filter((w) => w.length > 3 && msgLower.includes(w)).length;
  score += titleHits * 3;

  return score;
}

export function resolveKnowledge(
  classification: IntentClassification,
  userMessage: string
): KnowledgeResolutionResult {
  const { intent } = classification;

  if (!classification.needsKnowledge) {
    log.debug("Knowledge not needed", { intent });
    return { blocks: [], totalSelected: 0, categories: [] };
  }

  const preferredCategories = INTENT_CATEGORIES[intent] ?? [];
  const activeBlocks = KNOWLEDGE_BLOCKS.filter((b) => b.isActive);

  const scored = activeBlocks
    .map((block) => ({
      block,
      score: scoreBlock(block, intent, userMessage, preferredCategories as KnowledgeCategory[]),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CHAT.MAX_KNOWLEDGE_BLOCKS);

  const selected = scored.map(({ block }) => block);

  log.debug("Knowledge resolved", {
    intent,
    selected: selected.map((b) => b.slug).join(", "),
  });

  return {
    blocks: selected,
    totalSelected: selected.length,
    categories: [...new Set(selected.map((b) => b.category))],
  };
}

/**
 * Serializes selected blocks into a compact string for the prompt context.
 * Respects the character limit to avoid bloating the prompt.
 */
export function serializeKnowledgeContext(blocks: KnowledgeBlock[]): string | null {
  if (blocks.length === 0) return null;

  let total = 0;
  const parts: string[] = [];

  for (const block of blocks) {
    const chunk = `### ${block.title}\n${block.content}`;
    if (total + chunk.length > CHAT.MAX_KNOWLEDGE_CHARS) break;
    parts.push(chunk);
    total += chunk.length;
  }

  return parts.length > 0 ? parts.join("\n\n---\n\n") : null;
}
