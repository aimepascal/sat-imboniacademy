import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asLearningClient } from "@/lib/learning/db";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const chatInputSchema = z.object({
  message: z.string().min(1).max(4000),
  // Only the recent tail of the conversation is sent back on each turn, to
  // keep token usage (and cost) bounded as a chat gets long.
  history: z.array(chatMessageSchema).max(20).default([]),
});

const SYSTEM_PROMPT = `You are the Imboni SAT Hub AI Tutor, a warm and encouraging SAT prep coach built into the Imboni SAT Hub app.

Your job:
- Help students understand SAT Math, Reading, and Writing concepts.
- When a student asks a question, don't just give the final answer — walk through the reasoning so they learn the pattern, then state the answer clearly at the end.
- If a student seems to be struggling with a specific topic, gently ask a diagnostic question or two to pinpoint the actual gap (e.g. "is this about the algebra setup, or about reading the word problem?"), rather than re-explaining everything from scratch.
- Keep answers focused and concrete. Use short paragraphs, and use markdown (like **bold** for key terms, and numbered steps for multi-step problems) where it helps.
- Be encouraging without being saccharine — this is a free peer-support tool for real students studying for a real test.
- If asked something with nothing to do with the SAT or general study skills, gently redirect back to SAT prep.`;

export const sendTutorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => chatInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Uses your own Gemini API key (GEMINI_API_KEY in Vercel's Environment
    // Variables) — same setup as the admin content generator.
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Shares the daily AI limit with the practice screen's "AI help".
    const { data: allowed, error: quotaError } = await asLearningClient(context.supabase).rpc(
      "consume_ai_use",
    );
    if (quotaError) {
      throw new Error("AI help is not available right now");
    }
    if (!allowed) {
      throw new Error("You have used today's AI help. It resets tomorrow.");
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const result = streamText({
      model: google("gemini-2.0-flash"),
      instructions: SYSTEM_PROMPT,
      messages: [...data.history, { role: "user" as const, content: data.message }],
    });

    const reply = await result.text;
    return { reply };
  });

