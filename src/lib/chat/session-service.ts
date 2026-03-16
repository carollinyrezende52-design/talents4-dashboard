// src/lib/chat/session-service.ts
import { getSupabaseServer } from "@/lib/supabase/server";
import type { ChatSession, ChatMessage } from "@/types/chat";
import { CHAT } from "@/lib/utils/constants";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("session-service");

// ─── Session ──────────────────────────────────────────────────────────────────

export async function getOrCreateSession(
  sessionId: string,
  userId?: string
): Promise<ChatSession> {
  const db = getSupabaseServer();

  const { data: existing } = await db
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (existing) return existing as ChatSession;

  const { data: created, error } = await db
    .from("chat_sessions")
    .insert({
      id: sessionId,
      user_id: userId ?? null,
      title: "Nova conversa",
      summary: null,
    })
    .select()
    .single();

  if (error || !created) {
    log.error("Failed to create session", { error: error?.message });
    // Return a synthetic session if DB fails — chat still works
    return {
      id: sessionId,
      user_id: userId ?? null,
      title: "Nova conversa",
      summary: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return created as ChatSession;
}

export async function updateSessionSummary(
  sessionId: string,
  summary: string
): Promise<void> {
  const db = getSupabaseServer();
  await db
    .from("chat_sessions")
    .update({ summary, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getRecentMessages(
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const db = getSupabaseServer();

  const { data } = await db
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(CHAT.RECENT_MESSAGES);

  if (!data) return [];

  return (data as ChatMessage[])
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

export async function countSessionMessages(sessionId: string): Promise<number> {
  const db = getSupabaseServer();
  const { count } = await db
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  return count ?? 0;
}

export async function persistMessages(
  sessionId: string,
  userMessage: string,
  assistantAnswer: string,
  sourceType: "knowledge" | "database" | "hybrid" | "fallback" | "none"
): Promise<string | null> {
  const db = getSupabaseServer();

  const { data, error } = await db
    .from("chat_messages")
    .insert([
      { session_id: sessionId, role: "user", content: userMessage, source_type: "none" },
      { session_id: sessionId, role: "assistant", content: assistantAnswer, source_type: sourceType },
    ])
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    log.warn("Failed to persist messages", { error: error.message });
    return null;
  }

  // Return assistant message id for feedback
  return data?.[0]?.id ? String(data[0].id) : null;
}
