// A student's place in the lessons: enrolled, done, last practice score.
// Signed in: table learn_progress. Guest: this browser only, then saved to the
// account when the student signs in.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface Progress {
  enrolled: boolean;
  done: boolean;
  last_score: number | null;
  last_total: number | null;
  updated_at: string;
}
export type ProgressMap = Record<string, Progress>;

const GUEST_KEY = "imboni_guest_progress";

function readGuest(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeGuest(map: ProgressMap) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(map));
  } catch {
    // Storage blocked: progress lasts for this visit only.
  }
}

const key = (userId: string | null) => ["learn-progress", userId ?? "guest"];

export function useProgress(userId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key(userId),
    queryFn: async (): Promise<ProgressMap> => {
      if (!userId) return readGuest();
      const { data, error } = await db
        .from("learn_progress")
        .select("skill_id, enrolled, done, last_score, last_total, updated_at");
      if (error) throw new Error(error.message);
      const map: ProgressMap = {};
      for (const r of data ?? []) map[r.skill_id] = r;
      return map;
    },
    staleTime: 60_000,
  });

  // A guest who signs in keeps what they did as a guest.
  useEffect(() => {
    if (!userId) return;
    const guest = readGuest();
    const slugs = Object.keys(guest);
    if (!slugs.length) return;
    const rows = slugs.map((s) => ({ user_id: userId, skill_id: s, ...guest[s], updated_at: new Date().toISOString() }));
    db.from("learn_progress")
      // Only lessons the account does not have yet: never overwrite saved progress.
      .upsert(rows, { onConflict: "user_id,skill_id", ignoreDuplicates: true })
      .then(({ error }: { error: unknown }) => {
        if (!error) {
          writeGuest({});
          qc.invalidateQueries({ queryKey: key(userId) });
        }
      });
  }, [userId, qc]);

  const update = async (slug: string, change: Partial<Progress>) => {
    const current = query.data?.[slug];
    const next: Progress = {
      enrolled: false,
      done: false,
      last_score: null,
      last_total: null,
      ...current,
      ...change,
      updated_at: new Date().toISOString(),
    };
    qc.setQueryData<ProgressMap>(key(userId), (m) => ({ ...(m ?? {}), [slug]: next }));
    if (!userId) {
      writeGuest({ ...readGuest(), [slug]: next });
      return;
    }
    await db.from("learn_progress").upsert({ user_id: userId, skill_id: slug, ...next }, { onConflict: "user_id,skill_id" });
  };

  return { progress: query.data ?? {}, update, isLoading: query.isLoading };
}

/** The lesson the student touched most recently. */
export function lastLesson(map: ProgressMap): string | null {
  let best: string | null = null;
  let at = 0;
  for (const [slug, p] of Object.entries(map)) {
    const t = Date.parse(p.updated_at) || 0;
    if (t > at) {
      at = t;
      best = slug;
    }
  }
  return best;
}
