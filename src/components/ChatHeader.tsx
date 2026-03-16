// src/components/ChatHeader.tsx
"use client";

interface Props {
  sessionId: string;
  onNewSession: () => void;
}

export function ChatHeader({ sessionId, onNewSession }: Props) {
  const short = sessionId.slice(0, 8);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          T4
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
            {process.env.NEXT_PUBLIC_APP_NAME ?? "T4 Assistant"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Sessão {short}…
          </div>
        </div>
      </div>

      <button
        onClick={onNewSession}
        title="Nova conversa"
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "transparent",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.color = "var(--text)";
          (e.target as HTMLButtonElement).style.borderColor = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.color = "var(--text-muted)";
          (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
        }}
      >
        + Nova conversa
      </button>
    </div>
  );
}
