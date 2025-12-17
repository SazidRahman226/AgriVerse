import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { forumApi, Topic } from "@/api/forum";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForumTopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setTopics(await forumApi.listTopics());
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Forum</h1>
          <p className="text-sm text-muted-foreground">
            Choose a category (cows, rice, etc.)
          </p>
        </div>
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search topics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
      {err && <div className="text-sm text-destructive">{err}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <Card key={t.id} className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="capitalize">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.postCount} posts</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {t.description || "—"}
              </p>
              <Button asChild className="w-full">
                <Link to={`/forum/topics/${t.id}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
