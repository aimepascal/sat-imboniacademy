import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const contentTypeSchema = z.union([
  z.literal("resource"),
  z.literal("forum_post"),
]);

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const generateInputSchema = z.object({
  type: contentTypeSchema,
  prompt: z.string().min(1),
  history: z.array(chatMessageSchema).default([]),
});

const publishInputSchema = z.object({
  type: contentTypeSchema,
  draft: z.record(z.unknown()),
});

export type ContentType = z.infer<typeof contentTypeSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export type ResourceDraft = {
  title: string;
  category: string;
  section: string;
  summary: string;
  content: string;
};

export type ForumPostDraft = {
  title: string;
  body: string;
  topic: string;
};

export type GeneratedDraft = ResourceDraft | ForumPostDraft;

const resourceSchema = z.object({
  title: z.string(),
  category: z.string(),
  section: z.enum(["Math", "Reading", "Writing"]),
  summary: z.string(),
  content: z.string(),
});

const forumPostSchema = z.object({
  title: z.string(),
  body: z.string(),
  topic: z.enum(["General", "Math", "Reading", "Writing", "Strategy"]),
});

export const generateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => generateInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      throw new Error("Forbidden: admin access required");
    }

    // Calls Google Gemini with your own API key. Set GEMINI_API_KEY in
    // Vercel > Project > Settings > Environment Variables to use this feature.
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const instructions = buildSystemPrompt(data.type);
    const messages = [
      ...data.history,
      { role: "user" as const, content: data.prompt },
    ];

    const commonOptions = {
      model: google("gemini-2.0-flash"),
      messages,
      instructions,
    };

    let output: unknown;
    try {
      if (data.type === "resource") {
        const result = streamText({
          ...commonOptions,
          output: Output.object({ schema: resourceSchema }),
        });
        output = await result.output;
      } else {
        const result = streamText({
          ...commonOptions,
          output: Output.object({ schema: forumPostSchema }),
        });
        output = await result.output;
      }
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const text = error.text;
        if (!text) {
          throw new Error("AI returned empty content");
        }
        try {
          output = JSON.parse(text);
        } catch {
          throw new Error("AI returned invalid JSON: " + text.slice(0, 200));
        }
      } else {
        throw error;
      }
    }

    const draft = parseDraft(data.type, output as Record<string, unknown>);

    return {
      draft,
      assistantMessage: { role: "assistant" as const, content: JSON.stringify(output) },
      runId: null,
    };
  });

export const publishGeneratedContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => publishInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      throw new Error("Forbidden: admin access required");
    }

    const { type, draft: raw } = data;
    const draft = parseDraft(type, raw);

    if (type === "resource") {
      const d = draft as ResourceDraft;
      const { error } = await context.supabase.from("resources").insert({
        title: d.title,
        category: d.category,
        section: d.section,
        summary: d.summary,
        content: d.content,
        author_id: context.userId,
      });
      if (error) throw error;
    } else if (type === "forum_post") {
      const d = draft as ForumPostDraft;
      const { error } = await context.supabase.from("forum_posts").insert({
        user_id: context.userId,
        title: d.title,
        body: d.body,
        topic: d.topic,
      });
      if (error) throw error;
    }

    return { ok: true };
  });

function parseDraft(type: ContentType, raw: Record<string, unknown>): GeneratedDraft {
  switch (type) {
    case "resource":
      return resourceSchema.parse(raw);
    case "forum_post":
      return forumPostSchema.parse(raw);
  }
}

function buildSystemPrompt(type: ContentType): string {
  switch (type) {
    case "resource":
      return "You are an expert SAT tutor drafting a cheat code for the Imboni SAT Hub. Given a topic, produce a concise, student-friendly SAT shortcut. The content should be practical, include a clear strategy, and use markdown formatting where helpful.";
    case "forum_post":
      return "You are a student mentor drafting a forum post for the Imboni SAT Hub peer forum. Given a question or topic, produce a clear, helpful post that other students can learn from.";
  }
}
