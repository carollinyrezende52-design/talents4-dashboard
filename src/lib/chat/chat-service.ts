// src/lib/chat/chat-service.ts
// Orchestrates the full message pipeline:
//   input → classify → resolve knowledge → resolve data → generate → guard → persist

import type { ChatMessageInput, ChatMessageOutput, PipelineContext } from "@/types/chat";
import { classifyIntent } from "@/lib/ai/classify-intent";
import { generateFinalAnswer } from "@/lib/ai/generate-final-answer";
import { resolveKnowledge, serializeKnowledgeContext } from "@/lib/knowledge/knowledge-resolver";
import { resolveData } from "@/lib/data/data-resolver";
import { guardResponse } from "./response-guard";
import { summarizeSession } from "./summarizer";
import {
  getOrCreateSession,
  getRecentMessages,
  countSessionMessages,
  persistMessages,
  updateSessionSummary,
} from "./session-service";
import { sanitizeMessage } from "@/lib/utils/sanitize";
import { CHAT } from "@/lib/utils/constants";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("chat-service");

export async function processMessage(
  input: ChatMessageInput
): Promise<ChatMessageOutput> {
  const t0 = Date.now();
  const { sessionId, userId } = input;
  const userMessage = sanitizeMessage(input.message);

  log.info("▶ Processing message", { sessionId, length: String(userMessage.length) });

  // ─── Step 1: Session context ───────────────────────────────────────────────
  const session = await getOrCreateSession(sessionId, userId);
  const recentMessages = await getRecentMessages(sessionId);
  const sessionSummary = session.summary ?? null;

  // ─── Step 2: Classify intent (Call 1 to Gemini) ───────────────────────────
  const { classification, usedFallback: classifierFallback } = await classifyIntent({
    userMessage,
    sessionSummary,
    recentMessages,
  });

  log.info("Classified", {
    intent: classification.intent,
    action: classification.action,
    confidence: String(classification.confidence),
    fallback: String(classifierFallback),
  });

  // ─── Step 3: Resolve knowledge base ───────────────────────────────────────
  const knowledgeResult = resolveKnowledge(classification, userMessage);
  const knowledgeContext = serializeKnowledgeContext(knowledgeResult.blocks);

  // ─── Step 4: Resolve database (if needed) ─────────────────────────────────
  const { context: dataContext } = await resolveData(classification);

  // ─── Step 5: Build pipeline context ───────────────────────────────────────
  const ctx: PipelineContext = {
    sessionId,
    userId,
    userMessage,
    sessionSummary,
    recentMessages,
    classification,
    knowledgeContext,
    dataContext,
    usedKnowledge: knowledgeResult.totalSelected > 0,
    usedDatabase: dataContext !== null && classification.needsDatabase,
    hadFallback: classifierFallback,
    ambiguityDetected: classification.ambiguity.hasAmbiguity,
  };

  // ─── Step 6: Generate final answer (Call 2 to Gemini) ─────────────────────
  const { answer: rawAnswer, usedFallback: answerFallback } = await generateFinalAnswer({
    userMessage,
    sessionSummary,
    recentMessages,
    knowledgeContext,
    dataContext,
    ambiguityDetected: ctx.ambiguityDetected,
  });

  if (answerFallback) ctx.hadFallback = true;

  // ─── Step 7: Guard response ────────────────────────────────────────────────
  const guarded = guardResponse(rawAnswer);
  if (!guarded.ok) ctx.hadFallback = true;

  // ─── Step 8: Determine source type for logging ────────────────────────────
  let sourceType: "knowledge" | "database" | "hybrid" | "fallback" | "none" = "none";
  if (ctx.hadFallback) sourceType = "fallback";
  else if (ctx.usedKnowledge && ctx.usedDatabase) sourceType = "hybrid";
  else if (ctx.usedDatabase) sourceType = "database";
  else if (ctx.usedKnowledge) sourceType = "knowledge";

  // ─── Step 9: Persist messages ──────────────────────────────────────────────
  await persistMessages(sessionId, userMessage, guarded.answer, sourceType);

  // ─── Step 10: Summarise if session is growing ──────────────────────────────
  const messageCount = await countSessionMessages(sessionId);
  if (messageCount > 0 && messageCount % CHAT.SUMMARISE_AFTER === 0) {
    log.info("Triggering session summarisation", { messageCount: String(messageCount) });
    const updatedMessages = await getRecentMessages(sessionId);
    const newSummary = await summarizeSession(updatedMessages, sessionSummary);
    if (newSummary) await updateSessionSummary(sessionId, newSummary);
  }

  log.info("✅ Message processed", {
    ms: String(Date.now() - t0),
    sourceType,
    hadFallback: String(ctx.hadFallback),
  });

  return {
    ok: true,
    sessionId,
    answer: guarded.answer,
    meta: {
      intent: classification.intent,
      usedKnowledge: ctx.usedKnowledge,
      usedDatabase: ctx.usedDatabase,
      hadFallback: ctx.hadFallback,
      ambiguityDetected: ctx.ambiguityDetected,
    },
  };
}
