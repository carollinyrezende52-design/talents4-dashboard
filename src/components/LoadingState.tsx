// src/components/LoadingState.tsx
"use client";

export function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "18px 18px 18px 4px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--text-muted)",
              display: "inline-block",
              animation: "bounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// src/components/ErrorState.tsx
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "18px 18px 18px 4px",
          background: "#2a1515",
          border: "1px solid #5c2a2a",
          fontSize: 13,
          color: "var(--error)",
          maxWidth: "80%",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>⚠</span>
        <span>{message ?? "Erro ao processar. Tente novamente."}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginLeft: 8,
              fontSize: 12,
              color: "var(--accent)",
              textDecoration: "underline",
            }}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
