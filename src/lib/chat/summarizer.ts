// src/lib/chat/summarizer.ts
import { generateText } from "@/lib/ai/gemini-client";
import { SUMMARISER_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("summarizer");

export async function summarizeSession(
  messages: Array<{ role: string; content: string }>,
  existingSummary: string | null
): Promise<string> {
  const history = messages
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
    .join("\n");

  const userPrompt = existingSummary
    ? `Resumo anterior: ${existingSummary}\n\nNova parte da conversa:\n${history}\n\nGere um resumo atualizado.`
    : `Conversa:\n${history}\n\nGere um resumo objetivo.`;

  try {
    const summary = await generateText({
      systemPrompt: SUMMARISER_SYSTEM_PROMPT,
      userPrompt,
      maxOutputTokens: 300,
      temperature: 0.2,
      label: "summarizer",
    });
    return summary.trim().slice(0, 800); // hard cap
  } catch (err) {
    log.warn("Summarizer failed — keeping previous summary", {
      error: err instanceof Error ? err.message : String(err),
    });
    return existingSummary ?? "";
  }
}
