import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import { Link, useParams } from "react-router-dom";
import { forumApi, Post, Page } from "@/api/forum";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, ChevronLeft, ChevronRight, MessageSquare, Clock, User, ArrowLeft } from "lucide-react";

export default function ForumTopicPostsPage() {
  const { topicId } = useParams();
  const tid = Number(topicId);
  const PAGE_SIZE = 10;

  const [topicName, setTopicName] = useState("");
  const [pageData, setPageData] = useState<Page<Post> | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = async (newPageIndex: number, q: string) => {
    const page = await forumApi.listPostsByTopic(tid, newPageIndex, PAGE_SIZE, q);
    setPageData(page);
    setPosts(page.content);
    if (page.content[0]?.topicName) {
      setTopicName(page.content[0].topicName);
    } else {
      const topics = await forumApi.listTopics();
      setTopicName(topics.find((x) => x.id === tid)?.name || "");
    }
  };

  useEffect(() => { setPageIndex(0); }, [debouncedSearch]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await load(pageIndex, debouncedSearch);
      } catch (e: any) {
        setErr(e?.message || "Failed to load posts");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, pageIndex, debouncedSearch]);

  const totalPages = pageData?.totalPages ?? 0;
  const totalItems = pageData?.totalElements ?? 0;
  const canPrev = pageIndex > 0;
  const canNext = totalPages > 0 && pageIndex < totalPages - 1;

  const showingText = useMemo(() => {
    if (totalItems === 0) return "No posts";
    const start = pageIndex * PAGE_SIZE + 1;
    const end = start + posts.length - 1;
    return `${start}–${end} of ${totalItems}`;
  }, [pageData, pageIndex, posts.length]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        <BackButton />
        {/* ═══ Header ═══ */}
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link to="/forum" className="hover:text-foreground transition-colors">Forum</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium capitalize">{topicName || "Topic"}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight capitalize">{topicName || "Topic"}</h1>
              <p className="text-sm text-muted-foreground mt-1">{showingText} posts</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link to="/forum"><ArrowLeft className="h-4 w-4" /> Back</Link>
              </Button>
              <Button size="sm" className="gap-2" asChild>
                <Link to={`/forum/topics/${tid}/new`}><Plus className="h-4 w-4" /> New Post</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ Search + Pagination ═══ */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search posts…" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canPrev || loading} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {totalPages === 0 ? 0 : pageIndex + 1} / {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canNext || loading} onClick={() => setPageIndex((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {err && <div className="text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20 p-3">{err}</div>}

        {/* ═══ Posts ═══ */}
        <div className="space-y-3">
          {loading &&
            [1, 2, 3].map((i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

          {!loading && posts.map((p) => (
            <Link key={p.id} to={`/forum/posts/${p.id}`} className="block group">
              <Card className="border-border/50 transition-all duration-200 hover:border-primary/30 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                      {p.authorUsername?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-1">{p.title}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">
                          <MessageSquare className="h-3 w-3" /> {p.commentCount}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {p.authorUsername}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Empty */}
          {!loading && posts.length === 0 && (
            <Card className="border-border/50 border-dashed">
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <MessageSquare className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No posts yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Be the first to start a discussion!</p>
                <div className="flex gap-2">
                  {search && <Button variant="outline" size="sm" onClick={() => setSearch("")}>Clear search</Button>}
                  <Button size="sm" asChild><Link to={`/forum/topics/${tid}/new`}>Create Post</Link></Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
