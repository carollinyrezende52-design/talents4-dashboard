// src/types/chat.ts
import { z } from "zod";

// ─── Input / Output contracts ─────────────────────────────────────────────────

export const ChatMessageInputSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(4000),
  userId: z.string().min(1).optional(),
});
export type ChatMessageInput = z.infer<typeof ChatMessageInputSchema>;

export const ChatMessageOutputSchema = z.object({
  ok: z.boolean(),
  sessionId: z.string(),
  answer: z.string(),
  meta: z.object({
    intent: z.string(),
    usedKnowledge: z.boolean(),
    usedDatabase: z.boolean(),
    hadFallback: z.boolean(),
    ambiguityDetected: z.boolean(),
  }),
  error: z.string().optional(),
});
export type ChatMessageOutput = z.infer<typeof ChatMessageOutputSchema>;

// ─── Intent classification ────────────────────────────────────────────────────

export const IntentSchema = z.enum([
  "faq",
  "process_rule",
  "candidate_lookup",
  "candidate_status",
  "candidate_documents",
  "employer_lookup",
  "match_lookup",
  "mixed",
  "out_of_scope",
]);
export type Intent = z.infer<typeof IntentSchema>;

export const ActionSchema = z.enum([
  "none",
  "get_candidate_by_name",
  "get_candidate_status",
  "get_candidate_documents",
  "get_employer_by_name",
  "get_matches_by_candidate",
  "get_matches_by_employer",
]);
export type Action = z.infer<typeof ActionSchema>;

export const IntentClassificationSchema = z.object({
  intent: IntentSchema,
  needsDatabase: z.boolean(),
  needsKnowledge: z.boolean(),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    candidateName: z.string().optional(),
    candidateId: z.string().optional(),
    employerName: z.string().optional(),
    employerId: z.string().optional(),
    sessionTopic: z.string().optional(),
  }),
  action: ActionSchema,
  ambiguity: z.object({
    hasAmbiguity: z.boolean(),
    reason: z.string().optional(),
  }),
});
export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

// ─── Session / Message persistence ───────────────────────────────────────────

export interface ChatSession {
  id: string;
  user_id: string | null;
  title: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  source_type: "knowledge" | "database" | "hybrid" | "fallback" | "none";
  created_at: string;
}

export interface ChatFeedback {
  id: string;
  message_id: string;
  rating: 1 | -1;
  reason: string | null;
  created_at: string;
}

// ─── Pipeline context ─────────────────────────────────────────────────────────

export interface PipelineContext {
  sessionId: string;
  userId?: string;
  userMessage: string;
  sessionSummary: string | null;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  classification: IntentClassification;
  knowledgeContext: string | null;
  dataContext: string | null;
  usedKnowledge: boolean;
  usedDatabase: boolean;
  hadFallback: boolean;
  ambiguityDetected: boolean;
}

// ─── Feedback input ───────────────────────────────────────────────────────────

export const FeedbackInputSchema = z.object({
  messageId: z.string().min(1),
  rating: z.union([z.literal(1), z.literal(-1)]),
  reason: z.string().max(500).optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
