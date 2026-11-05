import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Control Center: page errors students hit, and a one-click backup. */
export function SiteHealth() {
  const errors = useQuery({
    queryKey: ["site-errors"],
    queryFn: async () => {
      const { data } = await db.from("site_errors").select("id, path, message, device, created_at").order("created_at", { ascending: false }).limit(30);
      return (data ?? []) as { id: number; path: string; message: string; device: string | null; created_at: string }[];
    },
  });
  const backup = async () => {
    const { data, error } = await db.rpc("admin_backup");
    if (error) return toast.error(error.message);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `imboni-backup-${new Date().toISOString().slice(0, 10)}.json` }).click();
    URL.revokeObjectURL(url);
  };
  const clear = async () => {
    await db.from("site_errors").delete().gte("id", 0);
    void errors.refetch();
  };
  const list = errors.data ?? [];
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <b>Page errors</b>
          {list.length > 0 && <button type="button" onClick={clear} className="text-sm font-semibold text-muted-foreground">Clear</button>}
        </div>
        {!list.length ? <p className="mt-1 text-sm text-muted-foreground">No errors. When a page breaks for a student, it shows here.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {list.map((e) => (
              <li key={e.id} className="rounded-lg bg-muted p-2"><span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()} · {e.path} · {e.device}</span><br />{e.message}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <b>Backup</b>
        <p className="mt-1 text-sm text-muted-foreground">Download lessons, questions, students' progress and the community as one file. Do it once a week and keep it somewhere safe.</p>
        <button type="button" onClick={backup} className="mt-3 h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Download backup</button>
      </div>
    </div>
  );
}
