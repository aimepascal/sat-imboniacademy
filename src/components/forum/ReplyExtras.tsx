// Forum extras: helpful votes, best answer, Tutor badge, and Report.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flag, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useTutors() {
  return useQuery({
    queryKey: ["forum-tutors"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await db.rpc("forum_tutors");
      return new Set<string>(((data ?? []) as (string | { forum_tutors: string })[]).map((x) => (typeof x === "string" ? x : x.forum_tutors)));
    },
  });
}

export function TutorBadge({ userId }: { userId: string }) {
  const { data } = useTutors();
  if (!data?.has(userId)) return null;
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Tutor</span>;
}

export function useVotes(replyIds: string[]) {
  return useQuery({
    queryKey: ["forum-votes", replyIds.join(",")],
    enabled: replyIds.length > 0,
    queryFn: async () => {
      const { data } = await db.from("forum_votes").select("reply_id, user_id").in("reply_id", replyIds);
      return (data ?? []) as { reply_id: string; user_id: string }[];
    },
  });
}

export function ReplyExtras(props: {
  replyId: string;
  isBest: boolean;
  canChooseBest: boolean;
  userId: string | null;
  votes: { reply_id: string; user_id: string }[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const mine = props.votes.some((v) => v.reply_id === props.replyId && v.user_id === props.userId);
  const count = props.votes.filter((v) => v.reply_id === props.replyId).length;
  const [reporting, setReporting] = useState(false);

  const vote = async () => {
    if (!props.userId) return toast("Sign in to mark answers as helpful.");
    const r = mine
      ? await db.from("forum_votes").delete().eq("reply_id", props.replyId).eq("user_id", props.userId)
      : await db.from("forum_votes").insert({ reply_id: props.replyId, user_id: props.userId });
    if (r.error) return toast.error("Could not save. Try again.");
    void qc.invalidateQueries({ queryKey: ["forum-votes"] });
  };
  const best = async () => {
    const { error } = await db.rpc("mark_best_reply", { _reply_id: props.replyId });
    if (error) return toast.error(error.message);
    toast.success("Marked as the best answer.");
    props.onChanged();
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-muted-foreground">
      <button type="button" onClick={vote} className={cn("flex items-center gap-1", mine && "text-primary")} aria-pressed={mine}>
        <ThumbsUp className="h-4 w-4" /> {count} helpful
      </button>
      {props.isBest ? (
        <span className="flex items-center gap-1 text-emerald-700"><Check className="h-4 w-4" /> Best answer</span>
      ) : props.canChooseBest ? (
        <button type="button" onClick={best} className="flex items-center gap-1 hover:text-emerald-700"><Check className="h-4 w-4" /> Mark as best answer</button>
      ) : null}
      {props.userId && (
        <button type="button" onClick={() => setReporting((v) => !v)} className="ml-auto flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> Report</button>
      )}
      {reporting && props.userId && <ReportBox userId={props.userId} replyId={props.replyId} onDone={() => setReporting(false)} />}
    </div>
  );
}

export function ReportBox({ userId, replyId, postId, onDone }: { userId: string; replyId?: string; postId?: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const send = async () => {
    const { error } = await db.from("forum_reports").insert({ user_id: userId, reply_id: replyId ?? null, post_id: postId ?? null, message: text.trim() });
    if (error) return toast.error("Could not send. Try again.");
    toast.success("Thank you. An admin will look at it.");
    onDone();
  };
  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3">
      <label className="text-sm font-semibold text-foreground" htmlFor={`rep-${replyId ?? postId}`}>What is wrong?</label>
      <textarea id={`rep-${replyId ?? postId}`} rows={2} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-sm font-normal" placeholder="Rude, spam, or a wrong answer…" />
      <button type="button" disabled={text.trim().length < 3} onClick={send} className="mt-2 h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">Send</button>
    </div>
  );
}
