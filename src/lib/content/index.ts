// Lessons, cheat codes and practice questions, read from the database.
//
// Tables (see supabase/migrations/20261105120000_lessons_in_database.sql):
//   lessons       one row per lesson, English text in `content`, Kinyarwanda in `content_rw`
//   site_content  sat_map, domain_notes, universal_codes, books
//   questions     read through lesson_questions() and check_answer(), never directly
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// The generated database types do not know these tables yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Section = "rw" | "m";

export interface LessonSummary {
  slug: string;
  parent_slug: string | null;
  section: Section;
  domain_slug: string;
  sort: number;
  name: string;
  name_rw: string | null;
  summary: string;
}

export interface LessonBlock {
  h: string;
  p?: string[];
  ex?: { q: string; steps?: string[]; ans: string };
}
export type Visual =
  | { type: "flow"; title?: string; steps: string[] }
  | { type: "table"; title?: string; head: string[]; rows: string[][] }
  | { type: "compare"; title?: string; left: { h: string; items: string[] }; right: { h: string; items: string[] } }
  | { type: "svg"; title?: string; svg: string; caption?: string };
export interface CheatCode {
  t: string;
  start: string;
  stop: string;
  skip: string;
  why: string;
  from?: number[];
}
export interface Video {
  id: string;
  title: string;
  channel: string;
}
export interface LessonContent {
  title: string;
  range: string;
  story: string;
  hope: string;
  lesson: LessonBlock[];
  visual: Visual[];
  subs: { name: string; def: string; covers?: string[] }[];
  spot: { t: string; s: string[] };
  videos: Video[];
  codes: CheatCode[];
}
export interface Lesson extends LessonSummary {
  content: LessonContent;
  content_rw: Partial<LessonContent>;
  published: boolean;
  updated_at: string;
}

export interface SatPart {
  id: Section;
  name: string;
  facts: string;
  domains: { id: string; name: string; pct: string; desc: string; skills: [string, string, string][] }[];
}
export interface DomainNote {
  ln: number;
  qs: string;
  at: string;
}
export interface UniversalCode {
  id: string;
  name: string;
  applies: "all" | "rw" | "m";
  oneline: string;
  story: string;
  teach: { h: string; p?: string[] }[];
  steps: string[];
  why: string;
  watch: string;
  apply: { skill: string; q: number; without: string; with: string; result: string }[];
  experiment: string;
}
export interface Book {
  title: string;
  note: string;
  url: string;
  price: string;
}
export interface SiteContent {
  sat_map: SatPart[];
  domain_notes: Record<string, DomainNote>;
  books: Book[];
}

export interface PracticeQuestion {
  id: string;
  position: number;
  level: "easy" | "medium" | "hard" | "very hard";
  context: string | null;
  table_data: { title?: string; head: string[]; rows: string[][]; note?: string } | null;
  svg: string | null;
  stem: string;
  options: string[];
  context_rw: string | null;
  stem_rw: string | null;
}
export interface AnswerCheck {
  correct: boolean;
  answer: number;
  why: string;
  why_rw: string | null;
}

const SUMMARY_COLUMNS = "slug, parent_slug, section, domain_slug, sort, name, name_rw, summary";

export const lessonIndexQuery = queryOptions({
  queryKey: ["content", "lessons"],
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<LessonSummary[]> => {
    const { data, error } = await db.from("lessons").select(SUMMARY_COLUMNS).order("sort");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const lessonQuery = (slug: string) =>
  queryOptions({
    queryKey: ["content", "lesson", slug],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Lesson | null> => {
      const { data, error } = await db.from("lessons").select("*").eq("slug", slug).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

/** The SAT map, domain notes and book list: small, used on most pages. */
export const siteContentQuery = queryOptions({
  queryKey: ["content", "site"],
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<SiteContent> => {
    const { data, error } = await db.from("site_content").select("key, data").in("key", ["sat_map", "domain_notes", "books"]);
    if (error) throw new Error(error.message);
    const out = { sat_map: [], domain_notes: {}, books: [] } as unknown as SiteContent;
    for (const row of data ?? []) (out as unknown as Record<string, unknown>)[row.key] = row.data;
    return out;
  },
});

/** The universal cheat codes (large): loaded only on pages that show them. */
export const universalCodesQuery = queryOptions({
  queryKey: ["content", "universal"],
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<UniversalCode[]> => {
    const { data, error } = await db.from("site_content").select("data").eq("key", "universal_codes").maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.data ?? []) as UniversalCode[];
  },
});

export const lessonQuestionsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["content", "questions", slug],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PracticeQuestion[]> => {
      const { data, error } = await db.rpc("lesson_questions", { _slug: slug });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export async function checkAnswer(questionId: string, choice: number): Promise<AnswerCheck> {
  const { data, error } = await db.rpc("check_answer", { _question_id: questionId, _choice: choice });
  if (error || !data) throw new Error(error?.message ?? "No answer");
  return data as AnswerCheck;
}

/** Saves one answer to the student's record (mastery, review list). Signed-in only. */
export async function recordAttempt(
  questionId: string,
  choice: number,
  timeMs: number | null,
  mode: "practice" | "diagnostic" | "review" | "assignment" = "practice",
) {
  await db.rpc("submit_attempts", {
    _batch: [
      {
        id: crypto.randomUUID(),
        question_id: questionId,
        option_index: choice,
        created_at: new Date().toISOString(),
        mode,
        time_ms: timeMs === null ? null : Math.round(timeMs),
      },
    ],
  });
}

export async function reportProblem(questionId: string, userId: string, message: string) {
  const { error } = await db
    .from("question_reports")
    .insert({ question_id: questionId, user_id: userId, message: message.trim().slice(0, 600) });
  if (error) throw new Error(error.message);
}

/** Picks the Kinyarwanda field when chosen and written; English otherwise. */
export function pick<T>(lang: string, en: T, rw: T | null | undefined): T {
  return lang === "rw" && rw !== undefined && rw !== null && rw !== "" ? rw : en;
}

/** Removes scripts and event handlers from lesson figures before showing them. */
export function cleanSvg(svg: string): string {
  return String(svg)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/javascript:/gi, "");
}

export const SECTION_NAME: Record<Section, string> = { rw: "Reading and Writing", m: "Math" };

/** Seconds per question on the real test: 64 min / 54 questions, 70 min / 44 questions. */
export const secondsPerQuestion = (section: Section) => (section === "rw" ? 71 : 95);

export function lessonPath(slug: string) {
  return `/learn/${slug}`;
}
