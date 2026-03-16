// src/components/ChatInput.tsx
"use client";

import { useRef, useEffect, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSubmit, disabled, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        padding: "12px 16px",
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder={placeholder ?? "Digite sua mensagem…"}
        rows={1}
        maxLength={4000}
        style={{
          flex: 1,
          resize: "none",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "10px 14px",
          color: "var(--text)",
          fontSize: 14,
          lineHeight: 1.5,
          outline: "none",
          overflowY: "hidden",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        title="Enviar (Enter)"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: disabled || !value.trim() ? "var(--surface2)" : "var(--accent)",
          color: disabled || !value.trim() ? "var(--text-muted)" : "#fff",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s",
          border: "1px solid var(--border)",
        }}
      >
        ↑
      </button>
    </div>
  );
}
