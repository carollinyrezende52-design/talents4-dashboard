// src/lib/utils/constants.ts

export const CHAT = {
  RECENT_MESSAGES: Number(process.env.CHAT_RECENT_MESSAGES ?? 6),
  SUMMARISE_AFTER: Number(process.env.CHAT_SUMMARISE_AFTER ?? 12),
  MAX_MESSAGE_LENGTH: Number(process.env.CHAT_MAX_MESSAGE_LENGTH ?? 4000),
  RATE_LIMIT_PER_MIN: Number(process.env.CHAT_RATE_LIMIT_PER_MIN ?? 20),
  MAX_KNOWLEDGE_BLOCKS: 4,
  MAX_KNOWLEDGE_CHARS: 6000,
} as const;

export const GEMINI = {
  MODEL: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  CLASSIFIER_MAX_TOKENS: Number(process.env.GEMINI_CLASSIFIER_MAX_TOKENS ?? 512),
  ANSWER_MAX_TOKENS: Number(process.env.GEMINI_ANSWER_MAX_TOKENS ?? 1024),
  TIMEOUT_MS: Number(process.env.GEMINI_TIMEOUT_MS ?? 20000),
} as const;
