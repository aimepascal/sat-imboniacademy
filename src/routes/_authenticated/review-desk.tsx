import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { canReviewQuestions, useRoles } from "@/hooks/use-roles";
import type { Difficulty } from "@/lib/learning/engine";
import {
  learningDb,
  type Question,
  type QuestionOption,
  type QuestionReview,
  type QuestionStatus,
  type Skill,
} from "@/lib/learning/db";

// Staff-only screen, so its text is in English and not in the dictionaries.
export const Route = createFileRoute("/_authenticated/review-desk")({
  head: () => ({ meta: [{ title: "Review desk | Imboni SAT Hub" }] }),
  component: ReviewDesk,
});

const STATUSES: { value: QuestionStatus; label: string }[] = [
  { value: "in_review", label: "In review" },
  { value: "draft", label: "Drafts" },
  { value: "approved", label: "Approved" },
  { value: "retired", label: "Retired" },
];

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Draft = {
  id: string | null;
  status: QuestionStatus;
  skill_id: string;
  difficulty: Difficulty;
  stem: string;
  options: QuestionOption[];
  explanation_en: string;
  explanation_rw: string;
};

const blankOption = (): QuestionOption => ({ text: "", is_correct: false, misconception_id: null });

function newDraft(skillId: string): Draft {
  return {
    id: null,
    status: "draft",
    skill_id: skillId,
    difficulty: "medium",
    stem: "",
    options: [{ ...blankOption(), is_correct: true }, blankOption(), blankOption(), blankOption()],
    explanation_en: "",
    explanation_rw: "",
  };
}

function toDraft(question: Question): Draft {
  return {
    id: question.id,
    status: question.status,
    skill_id: question.skill_id,
    difficulty: question.difficulty,
    stem: question.stem,
    options: question.options,
    explanation_en: question.explanation_en,
    explanation_rw: question.explanation_rw ?? "",
  };
}

/** Returns what is missing, or null when the question is complete enough to save. */
function problemWith(draft: Draft): string | null {
  if (!draft.skill_id) return "Choose a skill.";
  if (!draft.stem.trim()) return "Write the question.";
  if (draft.options.some((option) => !option.text.trim())) return "Fill in every answer option.";
  if (draft.options.filter((option) => option.is_correct).length !== 1) {
    return "Mark exactly one option as correct.";
  }
  if (!draft.explanation_en.trim()) return "Write the English explanation.";
  return null;
}

function ReviewDesk() {
  const { user } = Route.useRouteContext();
  const roles = useRoles(user.id);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<QuestionStatus>("in_review");
  const [draft, setDraft] = useState<Draft | null>(null);

  const allowed = canReviewQuestions(roles.data);

  const { data: skills = [] } = useQuery({
    queryKey: ["skills"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await learningDb.from("skills").select("*").order("name_en");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const questions = useQuery({
    queryKey: ["review-desk", status],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await learningDb
        .from("questions")
        .select("*")
        .eq("status", status)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  if (roles.isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        The review desk is for reviewers and admins.
      </div>
    );
  }

  const skillName = (id: string) => skills.find((skill) => skill.id === id)?.name_en ?? "";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["review-desk"] });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Review desk</h1>
        <Button
          onClick={() => setDraft(newDraft(skills[0]?.id ?? ""))}
          disabled={skills.length === 0}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New question
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Students only ever see approved questions. Editing an approved question sends it back to
        review.
      </p>

      {draft ? (
        <Editor
          key={draft.id ?? "new"}
          initial={draft}
          skills={skills}
          reviewerId={user.id}
          onClose={() => setDraft(null)}
          onChanged={refresh}
        />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {STATUSES.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={status === option.value ? "default" : "outline"}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <ul className="mt-4 grid gap-2">
            {questions.isLoading && <li className="text-sm text-muted-foreground">Loading…</li>}
            {questions.isError && (
              <li className="text-sm text-destructive">
                Questions could not be loaded: {questions.error.message}
              </li>
            )}
            {questions.data?.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Nothing here.
              </li>
            )}
            {questions.data?.map((question) => (
              <li key={question.id}>
                <button
                  type="button"
                  onClick={() => setDraft(toDraft(question))}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50"
                >
                  <p className="line-clamp-2 text-sm font-medium">{question.stem}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {skillName(question.skill_id)} · {question.difficulty} · version{" "}
                    {question.version}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type EditorProps = {
  initial: Draft;
  skills: Skill[];
  reviewerId: string;
  onClose: () => void;
  onChanged: () => void;
};

function Editor({ initial, skills, reviewerId, onClose, onChanged }: EditorProps) {
  const [draft, setDraft] = useState(initial);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: misconceptions = [] } = useQuery({
    queryKey: ["misconceptions", draft.skill_id],
    enabled: !!draft.skill_id,
    queryFn: async () => {
      const { data } = await learningDb
        .from("misconceptions")
        .select("*")
        .eq("skill_id", draft.skill_id)
        .order("label_en");
      return data ?? [];
    },
  });

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const setOption = (index: number, patch: Partial<QuestionOption>) =>
    set({
      options: draft.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    });

  /** Saves the question with the given status, and records the decision when there is one. */
  const save = async (nextStatus: QuestionStatus, decision?: QuestionReview["decision"]) => {
    const problem = problemWith(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    const fields = {
      skill_id: draft.skill_id,
      difficulty: draft.difficulty,
      stem: draft.stem.trim(),
      options: draft.options.map((option) => ({ ...option, text: option.text.trim() })),
      explanation_en: draft.explanation_en.trim(),
      explanation_rw: draft.explanation_rw.trim() || null,
      status: nextStatus,
    };

    const saved = draft.id
      ? await learningDb.from("questions").update(fields).eq("id", draft.id).select("id").single()
      : await learningDb
          .from("questions")
          .insert({ ...fields, created_by: reviewerId })
          .select("id")
          .single();

    if (saved.error) {
      setBusy(false);
      toast.error(`Not saved: ${saved.error.message}`);
      return;
    }

    if (decision) {
      const review = await learningDb.from("question_reviews").insert({
        question_id: saved.data.id,
        reviewer_id: reviewerId,
        decision,
        notes: notes.trim() || null,
      });
      if (review.error) toast.error(`Saved, but the review note was not: ${review.error.message}`);
    }

    setBusy(false);
    toast.success(
      decision === "approved"
        ? "Approved. Students can now see it."
        : decision === "sent_back"
          ? "Sent back to drafts."
          : decision === "retired"
            ? "Retired."
            : "Saved.",
    );
    onChanged();
    onClose();
  };

  const isApproved = initial.status === "approved";

  return (
    <div className="mt-6 grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="skill">Skill</Label>
          <select
            id="skill"
            className={selectClass}
            value={draft.skill_id}
            onChange={(event) =>
              // Misconception tags belong to a skill, so they are cleared when it changes.
              set({
                skill_id: event.target.value,
                options: draft.options.map((option) => ({ ...option, misconception_id: null })),
              })
            }
          >
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name_en}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="difficulty">Difficulty</Label>
          <select
            id="difficulty"
            className={selectClass}
            value={draft.difficulty}
            onChange={(event) => set({ difficulty: event.target.value as Difficulty })}
          >
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="stem">Question</Label>
        <Textarea
          id="stem"
          rows={4}
          value={draft.stem}
          onChange={(event) => set({ stem: event.target.value })}
        />
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Answer options (select the correct one)</legend>
        {draft.options.map((option, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                aria-label={`Option ${String.fromCharCode(65 + index)} is correct`}
                checked={option.is_correct}
                onChange={() =>
                  set({
                    options: draft.options.map((o, i) => ({
                      ...o,
                      is_correct: i === index,
                      // The correct answer is not a misconception.
                      misconception_id: i === index ? null : o.misconception_id,
                    })),
                  })
                }
                className="h-4 w-4"
              />
              <span className="w-5 text-sm font-semibold">{String.fromCharCode(65 + index)}</span>
              <Input
                value={option.text}
                aria-label={`Option ${String.fromCharCode(65 + index)}`}
                onChange={(event) => setOption(index, { text: event.target.value })}
              />
              {draft.options.length > 2 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                  onClick={() => set({ options: draft.options.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!option.is_correct && misconceptions.length > 0 && (
              <select
                className={cn(selectClass, "h-9")}
                aria-label={`Common slip behind option ${String.fromCharCode(65 + index)}`}
                value={option.misconception_id ?? ""}
                onChange={(event) =>
                  setOption(index, { misconception_id: event.target.value || null })
                }
              >
                <option value="">No common slip tagged</option>
                {misconceptions.map((misconception) => (
                  <option key={misconception.id} value={misconception.id}>
                    {misconception.label_en}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
        {draft.options.length < 6 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => set({ options: [...draft.options, blankOption()] })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add option
          </Button>
        )}
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="explanation-en">Explanation (English)</Label>
        <Textarea
          id="explanation-en"
          rows={5}
          value={draft.explanation_en}
          onChange={(event) => set({ explanation_en: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="explanation-rw">Explanation (Kinyarwanda, optional)</Label>
        <Textarea
          id="explanation-rw"
          rows={5}
          value={draft.explanation_rw}
          onChange={(event) => set({ explanation_rw: event.target.value })}
        />
      </div>

      {draft.id && (
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Review notes (kept with the decision)</Label>
          <Textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isApproved ? (
          <>
            <Button disabled={busy} onClick={() => save("approved")}>
              Save changes (returns to review)
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => save("retired", "retired")}>
              Retire
            </Button>
          </>
        ) : (
          <>
            <Button disabled={busy} onClick={() => save("approved", "approved")}>
              Approve
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => save("in_review")}>
              Save for review
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => save("draft")}>
              Save as draft
            </Button>
            {draft.id && initial.status === "in_review" && (
              <Button disabled={busy} variant="outline" onClick={() => save("draft", "sent_back")}>
                Send back
              </Button>
            )}
          </>
        )}
        <Button disabled={busy} variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
