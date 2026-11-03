import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  postId: z.string().uuid(),
});

const SYSTEM_PROMPT = `You are the Imboni SAT Hub AI Tutor. You're replying directly inside a student's forum thread, right under their question, as the very first response.

Your job:
- Actually answer/solve the question. If it's a Math problem, work through it step by step and give the final answer clearly. If it's a Reading or Writing question, explain the correct choice and why the others are wrong.
- Be concise but complete — this is a forum reply, not an essay. Use short paragraphs and markdown (bold, numbered steps) where it helps.
- Be warm and encouraging, like a peer tutor, not a textbook.
- If the question is too vague to solve (missing the actual answer choices, a cut-off image, etc.), say what's missing and give general strategy advice for that type of question instead.
- Sign off naturally as their AI tutor — human replies will follow below yours, so make clear you're a first-pass automated helper, not the final word.`;

export const generateForumAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      // AI replies are a nice-to-have, not a hard requirement — skip quietly
      // rather than failing the student's post if the key isn't set yet.
      return { posted: false, reason: "not_configured" as const };
    }

    // Don't double-post if an AI reply already exists on this thread (e.g. a
    // retried request, or the client firing twice in React strict mode).
    const { data: existing } = await context.supabase
      .from("forum_replies")
      .select("id")
      .eq("post_id", data.postId)
      .eq("is_ai_generated", true)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { posted: false, reason: "already_replied" as const };
    }

    const { data: post, error: postErr } = await context.supabase
      .from("forum_posts")
      .select("title, body, topic, user_id")
      .eq("id", data.postId)
      .single();
    if (postErr || !post) {
      throw new Error("Post not found");
    }

    // Only the post's own author triggers their thread's AI reply, and the
    // reply is filed under that same account (labeled as AI in the UI) so no
    // extra bot account or elevated database key is needed.
    if (post.user_id !== context.userId) {
      throw new Error("Only the post's author can request the AI reply for it");
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const result = streamText({
      model: google("gemini-2.0-flash"),
      instructions: SYSTEM_PROMPT,
      messages: [
        {
          role: "user" as const,
          content: `Topic: ${post.topic}\nTitle: ${post.title}\n\n${post.body}`,
        },
      ],
    });
    const reply = await result.text;

    const { error: insertErr } = await context.supabase.from("forum_replies").insert({
      post_id: data.postId,
      user_id: context.userId,
      body: reply,
      is_ai_generated: true,
    });
    if (insertErr) throw insertErr;

    return { posted: true as const };
  });
