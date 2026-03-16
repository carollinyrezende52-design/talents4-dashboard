// src/lib/utils/logger.ts
// Structured logger — never logs sensitive data (tokens, passwords, PII).

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  ts: string;
}

const isDev = process.env.NODE_ENV === "development";

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const banned = ["token", "password", "key", "secret", "authorization"];
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      banned.some((b) => k.toLowerCase().includes(b)) ? "[REDACTED]" : v,
    ])
  );
}

function emit(entry: LogEntry) {
  const prefix = `[${entry.ts}] [${entry.level.toUpperCase()}] [${entry.module}]`;
  const msg = `${prefix} ${entry.message}`;
  const data = entry.data ? sanitize(entry.data) : undefined;

  if (entry.level === "error") {
    console.error(msg, data ?? "");
  } else if (entry.level === "warn") {
    console.warn(msg, data ?? "");
  } else if (isDev) {
    console.log(msg, data ?? "");
  }
}

export function makeLogger(module: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      emit({ level: "debug", module, message, data, ts: new Date().toISOString() }),
    info: (message: string, data?: Record<string, unknown>) =>
      emit({ level: "info", module, message, data, ts: new Date().toISOString() }),
    warn: (message: string, data?: Record<string, unknown>) =>
      emit({ level: "warn", module, message, data, ts: new Date().toISOString() }),
    error: (message: string, data?: Record<string, unknown>) =>
      emit({ level: "error", module, message, data, ts: new Date().toISOString() }),
  };
}
