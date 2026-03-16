// src/lib/utils/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class ClassifierError extends AppError {
  constructor(message: string) {
    super(message, "CLASSIFIER_ERROR", 502);
    this.name = "ClassifierError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, "DATABASE_ERROR", 503);
    this.name = "DatabaseError";
  }
}

export class GeminiError extends AppError {
  constructor(message: string) {
    super(message, "GEMINI_ERROR", 502);
    this.name = "GeminiError";
  }
}

export function toSafeMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return "Erro interno desconhecido";
}
