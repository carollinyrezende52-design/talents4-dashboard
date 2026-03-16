// src/components/ChatMessage.tsx
"use client";

import { useState } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  hadFallback?: boolean;
  ambiguityDetected?: boolean;
}

interface Props {
  message: Message;
  onFeedback?: (messageId: string, rating: 1 | -1) => void;
}

export function ChatMessage({ message, onFeedback }: Props) {
  const [feedbackGiven, setFeedbackGiven] = useState<1 | -1 | null>(null);
  const isUser = message.role === "user";

  function handleFeedback(rating: 1 | -1) {
    if (feedbackGiven !== null) return;
    setFeedbackGiven(rating);
    onFeedback?.(message.id, rating);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 4,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser ? "var(--user-bubble)" : "var(--surface)",
          border: `1px solid ${isUser ? "transparent" : "var(--border)"}`,
          fontSize: 14,
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--text)",
        }}
      >
        {message.content}
        {message.hadFallback && (
          <span
            title="Resposta gerada via modo de contingência"
            style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", opacity: 0.7 }}
          >
            ⚡
          </span>
        )}
      </div>

      {/* Feedback buttons — only for assistant messages */}
      {!isUser && onFeedback && (
        <div style={{ display: "flex", gap: 4, paddingLeft: 4 }}>
          <FeedbackBtn
            label="👍"
            title="Resposta útil"
            active={feedbackGiven === 1}
            disabled={feedbackGiven !== null}
            onClick={() => handleFeedback(1)}
          />
          <FeedbackBtn
            label="👎"
            title="Resposta não útil"
            active={feedbackGiven === -1}
            disabled={feedbackGiven !== null}
            onClick={() => handleFeedback(-1)}
          />
        </div>
      )}
    </div>
  );
}

function FeedbackBtn({
  label,
  title,
  active,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        fontSize: 13,
        padding: "2px 6px",
        borderRadius: 6,
        background: active ? "var(--accent-dim)" : "transparent",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        color: disabled && !active ? "var(--text-muted)" : "var(--text)",
        opacity: disabled && !active ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
