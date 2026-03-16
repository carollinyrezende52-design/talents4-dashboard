// src/app/api/chat-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("api/chat-session");

const GetSessionSchema = z.object({ sessionId: z.string().min(1) });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = GetSessionSchema.safeParse({ sessionId: searchParams.get("sessionId") });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const db = getSupabaseServer();
    const { data: messages } = await db
      .from("chat_messages")
      .select("id, role, content, source_type, created_at")
      .eq("session_id", parsed.data.sessionId)
      .order("created_at", { ascending: true })
      .limit(100);

    return NextResponse.json({ ok: true, messages: messages ?? [] });
  } catch (err) {
    log.error("Failed to fetch session messages", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
