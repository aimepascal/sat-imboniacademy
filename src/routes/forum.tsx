import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Plus, X, Trash2, Paperclip, Image as ImageIcon, Search, Video } from "lucide-react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { SignInGate } from "@/components/SignInGate";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import type { FileAttachment } from "@/lib/forum-attachments";
import type { VideoAttachment } from "@/lib/forum-video";

export const Route = createFileRoute("/forum")({
  head: () => ({
    meta: [
      { title: "Peer Forum | Imboni SAT Hub" },
      { name: "description", content: "Ask SAT questions with a photo or PDF, and get clear step-by-step answers from other students and tutors." },
      { property: "og:title", content: "Imboni SAT Hub Peer Forum — Get unstuck on any SAT question" },
      { property: "og:description", content: "Post a screenshot or a PDF, get a peer-written breakdown. A focused community for students prepping for the SAT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://sat.imboniacademy.org/forum" },
    ],
    links: [{ rel: "canonical", href: "https://sat.imboniacademy.org/forum" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Imboni SAT Hub Peer Forum",
          url: "https://sat.imboniacademy.org/forum",
          description: "Students and tutors explain hard SAT questions in Math, Reading, Writing and strategy.",
          inLanguage: "en",
          isPartOf: { "@id": "https://sat.imboniacademy.org/#website" },
        }),
      },
    ],
  }),
  component: ForumPage,
});

const TOPICS = ["General", "Math", "Reading", "Writing", "Strategy"];
const FILTERS = ["All", ...TOPICS];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ForumPage() {
  const userId = useAuthUser();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");

  const { data: posts = [] } = useQuery({
    queryKey: ["forum-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("forum_posts")
        .select("*, profiles!forum_posts_profile_fk(display_name,avatar_url), forum_replies(count)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forum_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-posts"] });
      toast.success("Post deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete"),
  });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts.filter((p) => {
      const matchTopic = filter === "All" || p.topic === filter;
      const matchQ = !needle || `${p.title} ${p.body}`.toLowerCase().includes(needle);
      return matchTopic && matchQ;
    });
  }, [posts, q, filter]);

  const answered = posts.filter((p) => ((p.forum_replies as { count: number }[] | null)?.[0]?.count ?? 0) > 0).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              background:
                "radial-gradient(60% 80% at 90% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
            }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Peer forum</p>
              <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
                Ask. Answer. Learn together.
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Stuck on a question? Post it with a photo or a PDF, and other students and tutors explain it step by step.
              </p>
              {posts.length >= 10 && (
                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Questions</dt>
                    <dd className="font-display text-2xl">{posts.length}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Answered</dt>
                    <dd className="font-display text-2xl">{answered}</dd>
                  </div>
                </dl>
              )}
            </div>
            {userId ? (
              <Button size="lg" onClick={() => setShowForm(!showForm)}>
                {showForm ? (
                  <>
                    <X className="mr-1.5 h-4 w-4" /> Cancel
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-4 w-4" /> Ask a question
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {!userId && (
        <div className="mt-6">
          <SignInGate action="post a question, reply, or share a resource" />
        </div>
      )}

      {showForm && userId && <NewPostForm userId={userId} onDone={() => setShowForm(false)} />}

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:max-w-sm lg:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search questions…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === t
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 grid gap-5 lg:grid-cols-2">
        {visible.map((p) => {
          const replyCount = (p.forum_replies as { count: number }[] | null)?.[0]?.count ?? 0;
          const author = p.profiles?.display_name ?? "Student";
          return (
            <li key={p.id} className="group relative">
              {userId && p.user_id === userId && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm("Delete this post permanently?")) deletePost.mutate(p.id);
                  }}
                  className="absolute right-3 top-3 z-10 rounded-full bg-card/95 p-1.5 text-muted-foreground shadow-card backdrop-blur transition hover:text-destructive"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <Link
                to="/forum/$postId"
                params={{ postId: p.id }}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevated"
              >
                {p.image_url && (
                  <div className="relative h-48 overflow-hidden bg-surface-elevated">
                    <img
                      src={p.image_url}
                      alt={`Image attached to forum post: ${p.title}`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                      {p.topic}
                    </span>
                    {p.file_url && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <Paperclip className="h-3 w-3" /> Resource
                      </span>
                    )}
                    {p.image_url && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <ImageIcon className="h-3 w-3" /> Image
                      </span>
                    )}
                    {p.video_url && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <Video className="h-3 w-3" /> Video
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 font-display text-2xl leading-snug tracking-tight">{p.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {p.profiles?.avatar_url ? (
                        <img src={p.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {initials(author)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{author}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(p.created_at)}</p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-1.5 text-sm font-semibold">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> {replyCount}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground lg:col-span-2">
            {posts.length === 0 ? "No questions yet. Be the first to start the conversation." : "Nothing matches that search."}
          </li>
        )}
      </ul>
    </div>
  );
}

function NewPostForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState("General");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<FileAttachment | null>(null);
  const [video, setVideo] = useState<VideoAttachment | null>(null);
  const [uploading, setUploading] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) throw new Error("Add a title and some context");
      const { data: created, error } = await supabase
        .from("forum_posts")
        .insert({
          user_id: userId,
          title: title.trim().slice(0, 200),
          body: body.trim().slice(0, 5000),
          topic,
          image_url: imageUrl,
          ...(file ?? {}),
          ...(video ?? {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      return created?.id as string | undefined;
    },
    onSuccess: (postId) => {
      qc.invalidateQueries({ queryKey: ["forum-posts"] });
      toast.success("Question posted");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
      <div>
        <h2 className="font-display text-2xl tracking-tight">Ask the community</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick a topic, describe the problem, attach anything that helps.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              topic === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <Input
        placeholder="What's your question?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        className="h-12 text-base"
      />
      <Textarea
        placeholder="Add context, paste the question, describe what you've tried…"
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
      />

      <AttachmentPicker
        userId={userId}
        imageUrl={imageUrl}
        onImageChange={setImageUrl}
        file={file}
        onFileChange={setFile}
        video={video}
        onVideoChange={setVideo}
        busy={uploading}
        onBusyChange={setUploading}
      />

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button size="lg" onClick={() => submit.mutate()} disabled={submit.isPending || uploading}>
          Post question
        </Button>
        <button onClick={onDone} className="text-sm text-muted-foreground hover:text-foreground">
          Discard
        </button>
      </div>
    </div>
  );
}
