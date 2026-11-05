import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReplyExtras, TutorBadge, useVotes } from "@/components/forum/ReplyExtras";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Trash2, Loader2, MessageSquare, Bot } from "lucide-react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { SignInGate } from "@/components/SignInGate";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { AttachmentCard } from "@/components/AttachmentCard";
import { VideoCard } from "@/components/VideoCard";
import { downloadFromUrl, type FileAttachment } from "@/lib/forum-attachments";
import type { VideoAttachment } from "@/lib/forum-video";

export const Route = createFileRoute("/forum_/$postId")({
  loader: async ({ params }) => {
    const { data: post } = await supabase
      .from("forum_posts")
      .select("title,body,created_at")
      .eq("id", params.postId)
      .single();
    const { data: replies } = await supabase
      .from("forum_replies")
      .select("body,created_at")
      .eq("post_id", params.postId)
      .order("created_at", { ascending: true })
      .limit(20);
    return {
      title: post?.title ?? "Thread",
      body: post?.body ?? "",
      createdAt: post?.created_at ?? null,
      excerpt: (post?.body ?? "").slice(0, 155),
      replies: replies ?? [],
    };
  },
  head: ({ loaderData, params }) => {
    const url = `https://sat.imboniacademy.org/forum/${params?.postId}`;
    const qaSchema = loaderData
      ? {
          "@context": "https://schema.org",
          "@type": "QAPage",
          mainEntity: {
            "@type": "Question",
            name: loaderData.title,
            text: loaderData.body || loaderData.title,
            dateCreated: loaderData.createdAt,
            answerCount: loaderData.replies.length,
            ...(loaderData.replies.length > 0
              ? {
                  suggestedAnswer: loaderData.replies.map((r) => ({
                    "@type": "Answer",
                    text: r.body,
                    dateCreated: r.created_at,
                  })),
                }
              : {}),
          },
        }
      : null;
    return {
      meta: [
        { title: `${loaderData?.title ?? "Thread"} | Imboni SAT Hub Forum` },
        { name: "description", content: loaderData?.excerpt || "A peer discussion thread on the Imboni SAT Hub forum." },
        { property: "og:title", content: loaderData?.title ?? "Imboni SAT Hub Forum Thread" },
        { property: "og:description", content: loaderData?.excerpt || "A peer discussion thread on the Imboni SAT Hub forum." },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: qaSchema ? [{ type: "application/ld+json", children: JSON.stringify(qaSchema) }] : [],
    };
  },
  component: ThreadPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function Avatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";
  if (url) return <img src={url} alt="" className={`${cls} shrink-0 rounded-full object-cover`} />;
  return (
    <span className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary`}>
      {initials(name)}
    </span>
  );
}

function AiAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  return (
    <span className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground`}>
      <Bot className={size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} />
    </span>
  );
}

function ThreadPage() {
  const { postId } = Route.useParams();
  const userId = useAuthUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reply, setReply] = useState("");
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);
  const [replyFile, setReplyFile] = useState<FileAttachment | null>(null);
  const [replyVideo, setReplyVideo] = useState<VideoAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState<string | null>(null);

  const { data: post } = useQuery({
    queryKey: ["forum-post", postId],
    queryFn: async () =>
      (
        await supabase
          .from("forum_posts")
          .select("*, profiles!forum_posts_profile_fk(display_name,avatar_url)")
          .eq("id", postId)
          .single()
      ).data,
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["forum-replies", postId],
    queryFn: async () => {
      const { data } = await supabase
        .from("forum_replies")
        .select("*, profiles!forum_replies_profile_fk(display_name,avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      return data ?? [];
    },
  });
  const votes = useVotes(replies.map((r) => r.id));
  const { data: isAdminUser } = useIsAdmin(userId);

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const body = reply.trim();
      if (!body && !replyImageUrl && !replyFile && !replyVideo) return;
      const { error } = await supabase.from("forum_replies").insert({
        post_id: postId,
        user_id: userId,
        body: body.slice(0, 5000),
        image_url: replyImageUrl,
        ...(replyFile ?? {}),
        ...(replyVideo ?? {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      setReplyImageUrl(null);
      setReplyFile(null);
      setReplyVideo(null);
      qc.invalidateQueries({ queryKey: ["forum-replies", postId] });
      toast.success("Breakdown posted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't post reply"),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-posts"] });
      toast.success("Post deleted");
      navigate({ to: "/forum" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete"),
  });

  const deleteReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forum_replies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-replies", postId] });
      toast.success("Reply removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete"),
  });

  const downloadImage = async (url: string, label: string) => {
    setDownloadingImage(label);
    try {
      const ext = url.split("?")[0].split(".").pop()?.slice(0, 5) || "jpg";
      await downloadFromUrl(url, `sat-hub-${label}.${ext}`);
    } catch {
      toast.error("Couldn't download image");
    } finally {
      setDownloadingImage(null);
    }
  };

  if (!post) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>;

  const author = post.profiles?.display_name ?? "Student";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/forum" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to forum
      </Link>

      <article className="mt-5 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              {post.topic}
            </span>
            {userId && post.user_id === userId && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deletePost.isPending}
                onClick={() => {
                  if (confirm("Delete this post permanently?")) deletePost.mutate();
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete post
              </Button>
            )}
          </div>
          <h1 className="mt-4 font-display text-3xl leading-[1.1] tracking-tight sm:text-4xl">{post.title}</h1>
          {(post as { lesson_slug?: string | null }).lesson_slug && (
            <a href={`/learn/${(post as { lesson_slug?: string }).lesson_slug}`} className="mt-2 inline-block text-sm font-semibold text-primary underline">Open the lesson for this question →</a>
          )}
          <div className="mt-5 flex items-center gap-3">
            <Avatar name={author} url={post.profiles?.avatar_url} />
            <div>
              <p className="text-sm font-semibold">{author}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          <p className="mt-6 whitespace-pre-wrap text-base leading-[1.75] text-foreground/90">{post.body}</p>

          {(post.image_url || post.file_url || post.video_url) && (
            <div className="mt-6 space-y-3 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Attachments</p>
              {post.image_url && (
                <figure className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
                  <img
                    src={post.image_url}
                    alt={`Image attached to forum post: ${post.title}`}
                    className="max-h-[32rem] w-full object-contain"
                  />
                  <figcaption className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                    <span className="text-xs text-muted-foreground">Shared image</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingImage === `post-${postId}`}
                      onClick={() => downloadImage(post.image_url!, `post-${postId}`)}
                    >
                      {downloadingImage === `post-${postId}` ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1 h-3.5 w-3.5" />
                      )}
                      Download
                    </Button>
                  </figcaption>
                </figure>
              )}
              {post.video_url && (
                <VideoCard url={post.video_url} name={post.video_name} size={post.video_size} />
              )}
              {post.file_url && (
                <AttachmentCard url={post.file_url} name={post.file_name} type={post.file_type} size={post.file_size} />
              )}
            </div>
          )}
        </div>
      </article>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-2xl tracking-tight">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          {replies.length} {replies.length === 1 ? "breakdown" : "breakdowns"}
        </h2>

        <ul className="mt-5 space-y-4">
          {[...replies].sort((x, y) => Number(!!(y as { is_best?: boolean }).is_best) - Number(!!(x as { is_best?: boolean }).is_best)).map((r) => {
            const isAi = r.is_ai_generated;
            const rAuthor = isAi ? "Imboni helper" : (r.profiles?.display_name ?? "Student");
            return (
              <li
                key={r.id}
                className={`rounded-2xl border p-5 shadow-card sm:p-6 ${isAi ? "border-primary/30 bg-primary-soft/40" : "border-border bg-card"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {isAi ? <AiAvatar size="sm" /> : <Avatar name={rAuthor} url={r.profiles?.avatar_url} size="sm" />}
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {rAuthor}
                        {!isAi && <TutorBadge userId={r.user_id} />}
                        {isAi && (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                            AI
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isAi
                          ? "First-pass answer — check it against a human reply too"
                          : new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                  {userId && r.user_id === userId && (
                    <button
                      onClick={() => {
                        if (confirm("Delete this reply?")) deleteReply.mutate(r.id);
                      }}
                      className="text-muted-foreground transition hover:text-destructive"
                      aria-label="Delete reply"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {r.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-[1.7] text-foreground/90">{r.body}</p>}
                {r.image_url && (
                  <figure className="mt-4 overflow-hidden rounded-xl border border-border bg-surface-elevated">
                    <img src={r.image_url} alt="Image attached to reply" className="max-h-96 w-full object-contain" loading="lazy" />
                    <figcaption className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">Shared image</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloadingImage === `reply-${r.id}`}
                        onClick={() => downloadImage(r.image_url!, `reply-${r.id}`)}
                      >
                        {downloadingImage === `reply-${r.id}` ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-1 h-3.5 w-3.5" />
                        )}
                        Download
                      </Button>
                    </figcaption>
                  </figure>
                )}
                {r.video_url && (
                  <div className="mt-4">
                    <VideoCard url={r.video_url} name={r.video_name} size={r.video_size} />
                  </div>
                )}
                {r.file_url && (
                  <div className="mt-4">
                    <AttachmentCard url={r.file_url} name={r.file_name} type={r.file_type} size={r.file_size} />
                  </div>
                )}
                <ReplyExtras replyId={r.id} isBest={!!(r as { is_best?: boolean }).is_best} canChooseBest={!!userId && (post?.user_id === userId || !!isAdminUser)} userId={userId} votes={votes.data ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ["forum-replies", postId] })} />
              </li>
            );
          })}
          {replies.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No breakdowns yet. Be the first to explain it.
            </li>
          )}
        </ul>

        {userId ? (
          <div className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-display text-xl tracking-tight">Add your breakdown</h3>
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Walk through your step-by-step breakdown…"
              rows={5}
              maxLength={5000}
            />
            <AttachmentPicker
              userId={userId}
              imageUrl={replyImageUrl}
              onImageChange={setReplyImageUrl}
              file={replyFile}
              onFileChange={setReplyFile}
              video={replyVideo}
              onVideoChange={setReplyVideo}
              busy={uploading}
              onBusyChange={setUploading}
            />
            <div className="border-t border-border pt-4">
              <Button
                size="lg"
                onClick={() => submit.mutate()}
                disabled={
                  (!reply.trim() && !replyImageUrl && !replyFile && !replyVideo) || submit.isPending || uploading
                }
              >
                Post breakdown
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <SignInGate action="post a breakdown or share a resource" />
          </div>
        )}
      </section>
    </div>
  );
}
