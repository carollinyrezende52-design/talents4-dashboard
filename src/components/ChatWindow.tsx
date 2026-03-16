// src/components/ChatWindow.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage, type Message } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { LoadingState, ErrorState } from "./LoadingState";
import type { ChatMessageOutput } from "@/types/chat";

// ─── Session ID ───────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return generateSessionId();
  const stored = sessionStorage.getItem("t4_session_id");
  if (stored) return stored;
  const id = generateSessionId();
  sessionStorage.setItem("t4_session_id", id);
  return id;
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function sendMessage(
  sessionId: string,
  message: string
): Promise<ChatMessageOutput> {
  const res = await fetch("/api/chat/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });

  const data = (await res.json()) as ChatMessageOutput;

  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  return data;
}

async function sendFeedback(messageId: string, rating: 1 | -1): Promise<void> {
  await fetch("/api/chat-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, rating }),
  });
}

// ─── Welcome message ──────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Sou o assistente da Talents4. Posso te ajudar com informações sobre o processo de recrutamento, status de candidatos, documentos necessários e muito mais.\n\nComo posso te ajudar hoje?",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatWindow() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement>(null);

  // Init session id on client only
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !sessionId) return;

    setInput("");
    setError(null);
    setLastUserMessage(text);

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await sendMessage(sessionId, text);

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        content: result.answer,
        hadFallback: result.meta.hadFallback,
        ambiguityDetected: result.meta.ambiguityDetected,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const handleRetry = useCallback(async () => {
    if (!lastUserMessage) return;
    setInput(lastUserMessage);
    setError(null);
  }, [lastUserMessage]);

  const handleFeedback = useCallback(async (messageId: string, rating: 1 | -1) => {
    try {
      await sendFeedback(messageId, rating);
    } catch {
      // Feedback failure is silent — don't disrupt the chat
    }
  }, []);

  function handleNewSession() {
    const id = generateSessionId();
    sessionStorage.setItem("t4_session_id", id);
    setSessionId(id);
    setMessages([WELCOME]);
    setInput("");
    setError(null);
    setLastUserMessage("");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg)",
        maxWidth: 760,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <ChatHeader sessionId={sessionId} onNewSession={handleNewSession} />

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px 8px",
        }}
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onFeedback={msg.role === "assistant" && msg.id !== "welcome" ? handleFeedback : undefined}
          />
        ))}

        {loading && <LoadingState />}

        {error && (
          <ErrorState
            message={error}
            onRetry={handleRetry}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={loading || !sessionId}
        placeholder="Pergunte sobre candidatos, documentos, processo…"
      />
    </div>
  );
}
