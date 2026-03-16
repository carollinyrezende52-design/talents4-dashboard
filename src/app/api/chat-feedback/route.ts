// src/app/api/chat-feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { FeedbackInputSchema } from "@/types/chat";
import { getSupabaseServer } from "@/lib/supabase/server";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("api/chat-feedback");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = FeedbackInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid feedback data" }, { status: 400 });
    }

    const { messageId, rating, reason } = parsed.data;
    const db = getSupabaseServer();

    const { error } = await db.from("chat_feedback").insert({
      message_id: messageId,
      rating,
      reason: reason ?? null,
    });

    if (error) {
      log.error("Failed to save feedback", { error: error.message });
      return NextResponse.json({ ok: false, error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Unexpected error in feedback route", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
