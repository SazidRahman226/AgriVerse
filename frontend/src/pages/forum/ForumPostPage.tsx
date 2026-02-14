import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import { Link, useParams } from "react-router-dom";
import { forumApi, Comment, Post } from "@/api/forum";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, ArrowLeft, MessageSquare, Clock, Send, Loader2, User } from "lucide-react";

export default function ForumPostPage() {
  const { postId } = useParams();
  const pid = Number(postId);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const p = await forumApi.getPost(pid);
    const c = await forumApi.listComments(pid, 0, 200);
    setPost(p);
    setComments(c.content);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await load();
      } catch (e: any) {
        setErr(e?.message || "Failed to load post");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const canSend = useMemo(() => text.trim().length > 0 && !sending, [text, sending]);

  const onComment = async () => {
    try {
      setSending(true);
      setErr(null);
      const c = text.trim();
      if (!c) throw new Error("Comment cannot be empty");
      await forumApi.createComment(pid, { content: c });
      setText("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to comment");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        <BackButton />
        {err && <div className="text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20 p-3">{err}</div>}

        {post && (
          <>
            {/* ═══ Breadcrumb ═══ */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/forum" className="hover:text-foreground transition-colors">Forum</Link>
              <ChevronRight className="h-3 w-3" />
              <Link to={`/forum/topics/${post.topicId}`} className="hover:text-foreground transition-colors capitalize">{post.topicName}</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium truncate max-w-[200px]">{post.title}</span>
            </div>

            {/* ═══ Post Header ═══ */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{post.title}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{post.authorUsername}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(post.createdAt).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    <MessageSquare className="h-3 w-3" /> {comments.length}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2 shrink-0" asChild>
                <Link to={`/forum/topics/${post.topicId}`}><ArrowLeft className="h-4 w-4" /> Back</Link>
              </Button>
            </div>

            {/* ═══ Post Body ═══ */}
            <Card className="border-border/50 overflow-hidden">
              <div className="border-b border-border/50 bg-muted/20 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {post.authorUsername?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{post.authorUsername}</div>
                    <div className="text-xs text-muted-foreground">Author • {new Date(post.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <CardContent className="p-5 sm:p-6">
                <div className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{post.content}</div>
              </CardContent>
            </Card>

            {/* ═══ Reply Box ═══ */}
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-3">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write your reply…"
                  className="min-h-[100px] resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{text.length} characters</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={sending || !text}>Clear</Button>
                    <Button size="sm" onClick={onComment} disabled={!canSend} className="gap-2">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sending ? "Sending…" : "Reply"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ═══ Comments ═══ */}
            <div>
              <Separator className="mb-6" />
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                {comments.length} {comments.length === 1 ? "Reply" : "Replies"}
              </h2>

              <div className="space-y-3">
                {comments.map((c) => (
                  <Card key={c.id} className="border-border/50 bg-card/60">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                          {c.authorUsername?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{c.authorUsername}</span>
                            <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{c.content}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {comments.length === 0 && (
                  <Card className="border-border/50 border-dashed">
                    <CardContent className="py-10 text-center">
                      <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="font-medium text-sm">No replies yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Be the first to contribute!</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
