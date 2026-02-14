import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import { Link } from "react-router-dom";
import { forumApi, Topic } from "@/api/forum";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, Plus, Search, Folder, ChevronRight, Loader2 } from "lucide-react";

export default function ForumTopicsPage() {
  const { isAdmin } = useAuth();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const list = await forumApi.listTopics();
    setTopics(list);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await load();
      } catch (e: any) {
        setErr(e?.message || "Failed to load topics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    );
  }, [topics, query]);

  const onCreateTopic = async () => {
    try {
      setCreating(true);
      setErr(null);
      const name = newName.trim();
      const description = newDesc.trim();
      if (!name) throw new Error("Forum name is required");
      await forumApi.createTopic({ name, description: description || undefined });
      setNewName("");
      setNewDesc("");
      setOpen(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to create forum");
    } finally {
      setCreating(false);
    }
  };

  const onDialogOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { setNewName(""); setNewDesc(""); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
        <BackButton />
        {/* ═══ Header ═══ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-sm font-medium mb-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Community
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Forum</h1>
            <p className="text-muted-foreground mt-1">Ask questions, share tips, and learn from the community.</p>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={onDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" /> Create Forum
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create a new forum</DialogTitle>
                  <DialogDescription>Create a category for a crop, animal, or topic (admins only).</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Forum name</label>
                    <Input placeholder="e.g. rice, wheat, cattle" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <p className="text-xs text-muted-foreground">It will be shown as a category.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description (optional)</label>
                    <Textarea placeholder="What belongs in this forum?" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="min-h-[100px]" />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancel</Button>
                  <Button onClick={onCreateTopic} disabled={creating} className="gap-2">
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {creating ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* ═══ Search ═══ */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search forums…" className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {err && <div className="text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20 p-3">{err}</div>}

        {/* ═══ Grid ═══ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading &&
            [1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}

          {!loading &&
            filtered.map((t) => (
              <Link key={t.id} to={`/forum/topics/${t.id}`} className="group outline-none">
                <Card className="h-full border-border/50 transition-all duration-200 hover:border-primary/30 hover:shadow-md group-hover:scale-[1.01]">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                          <Folder className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold capitalize">{t.name}</h3>
                          <span className="text-xs text-muted-foreground">{t.postCount} posts</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{t.description || "No description yet."}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
        </div>

        {/* ═══ Empty ═══ */}
        {!loading && filtered.length === 0 && (
          <Card className="border-border/50 border-dashed">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No forums found</h3>
              <p className="text-sm text-muted-foreground">Try a different search term.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
