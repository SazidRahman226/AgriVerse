import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { forumApi } from "@/api/forum";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ChevronRight, PenLine, Loader2, Lightbulb } from "lucide-react";

export default function CreateForumPostPage() {
  const { topicId } = useParams();
  const tid = Number(topicId);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const titleTrimmed = title.trim();
  const contentTrimmed = content.trim();
  const canPublish = titleTrimmed.length > 0 && contentTrimmed.length > 0 && !saving;

  const onSubmit = async () => {
    try {
      setSaving(true);
      setErr(null);
      if (!titleTrimmed || !contentTrimmed) throw new Error("Title and content are required");
      const created = await forumApi.createPost({ topicId: tid, title: titleTrimmed, content: contentTrimmed });
      navigate(`/forum/posts/${created.id}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to create post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/forum" className="hover:text-foreground transition-colors">Forum</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to={`/forum/topics/${tid}`} className="hover:text-foreground transition-colors">Topic</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">New Post</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              Create Post
            </h1>
            <p className="text-sm text-muted-foreground mt-2">Share your question or insight with the community.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" asChild>
            <Link to={`/forum/topics/${tid}`}><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
        </div>

        {err && <div className="text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20 p-3">{err}</div>}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <Card className="lg:col-span-2 border-border/50">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="e.g. Rice leaves turning yellow—what should I do?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Keep it short and specific.</span>
                  <span className={title.length > 100 ? "text-amber-600" : ""}>{title.length}/120</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Details</label>
                <Textarea
                  placeholder={"Write the full details:\n- What crop/animal?\n- Symptoms?\n- When it started?\n- Location (district/upazila)?"}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[220px] resize-none"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Use bullet points for clarity.</span>
                  <span>{content.length} chars</span>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
                <Button variant="ghost" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
                <Button onClick={onSubmit} disabled={!canPublish} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  {saving ? "Publishing…" : "Publish Post"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tips Sidebar */}
          <div className="space-y-4">
            <Card className="border-border/50 bg-amber-500/5">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold">Writing Tips</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    Include your crop type and variety
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    Describe symptoms in detail
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    Mention when the issue started
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    Add your location for local advice
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    Share what you've already tried
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
