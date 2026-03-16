// src/app/api/chat/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ChatMessageInputSchema } from "@/types/chat";
import { processMessage } from "@/lib/chat/chat-service";
import { makeLogger } from "@/lib/utils/logger";
import { toSafeMessage } from "@/lib/utils/errors";

const log = makeLogger("api/chat/message");

// Simple in-memory rate limiter (per sessionId, resets on server restart)
// For production: replace with Redis or Upstash
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = Number(process.env.CHAT_RATE_LIMIT_PER_MIN ?? 20);

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate input schema
    const parsed = ChatMessageInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Rate limit
    if (!checkRateLimit(input.sessionId)) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    // Process
    const result = await processMessage(input);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = toSafeMessage(err);
    log.error("Unhandled error in /api/chat/message", { error: message });
    return NextResponse.json(
      {
        ok: false,
        sessionId: "",
        answer: "Ocorreu um erro interno. Por favor, tente novamente.",
        meta: {
          intent: "out_of_scope",
          usedKnowledge: false,
          usedDatabase: false,
          hadFallback: true,
          ambiguityDetected: false,
        },
        error: message,
      },
      { status: 500 }
    );
  }
}

// Only POST allowed
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
