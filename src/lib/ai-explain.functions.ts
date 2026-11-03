import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asLearningClient } from "@/lib/learning/db";

const inputSchema = z.object({
  questionId: z.string().uuid(),
  // The option the student picked, so the AI can speak to that mistake.
  optionIndex: z.number().int().min(0).max(5),
  language: z.enum(["en", "rw"]).default("en"),
});

const SYSTEM_PROMPT = `You are "AI help" inside the Imboni SAT Hub practice screen. A student has already read the reviewed explanation for an SAT question and asked for it to be explained a different way.

Rules:
- The reviewed explanation you are given is correct and is the authority. Never contradict it, and never arrive at a different answer.
- Explain the same reasoning from a different angle: a simpler wording, a small worked example, or the idea behind the step the student most likely missed.
- If the student's choice was wrong, say briefly why that choice is tempting and where it goes wrong.
- Keep it short: at most 120 words, plain text, no headings.
- Write in the language you are asked for. Keep maths notation and the answer choices as they are.`;

export type AiExplainResult =
  | { status: "ok"; text: string }
  // "limited": today's limit is used up. "unavailable": anything else went
  // wrong. Either way the screen keeps showing the reviewed explanation.
  | { status: "limited" }
  | { status: "unavailable" };

/**
 * Optional second explanation for a practice question, grounded in the
 * reviewed one. Never throws for AI problems: the caller always gets a status
 * it can show next to the reviewed explanation.
 */
export const explainDifferently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AiExplainResult> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { status: "unavailable" };

    const db = asLearningClient(context.supabase);

    // Read with the student's own access, so only approved questions are found.
    const { data: question } = await db
      .from("questions")
      .select("stem, options, explanation_en")
      .eq("id", data.questionId)
      .eq("status", "approved")
      .maybeSingle();
    if (!question) return { status: "unavailable" };

    const { data: allowed, error: quotaError } = await db.rpc("consume_ai_use");
    if (quotaError) return { status: "unavailable" };
    if (!allowed) return { status: "limited" };

    const letter = (index: number) => String.fromCharCode(65 + index);
    const correctIndex = question.options.findIndex((option) => option.is_correct);
    const prompt = [
      `Question: ${question.stem}`,
      ...question.options.map((option, index) => `${letter(index)}. ${option.text}`),
      `Correct answer: ${letter(correctIndex)}`,
      `The student chose: ${letter(data.optionIndex)}`,
      `Reviewed explanation: ${question.explanation_en}`,
      `Explain it differently, in ${data.language === "rw" ? "Kinyarwanda" : "English"}.`,
    ].join("\n");

    try {
      const google = createGoogleGenerativeAI({ apiKey });
      const result = streamText({
        model: google("gemini-2.0-flash"),
        instructions: SYSTEM_PROMPT,
        messages: [{ role: "user" as const, content: prompt }],
      });
      const text = (await result.text).trim();
      return text ? { status: "ok", text } : { status: "unavailable" };
    } catch (error) {
      console.error("[ai-explain]", error);
      return { status: "unavailable" };
    }
  });
