import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { forumApi, Post } from "@/api/forum";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Shield, MessageSquare, Briefcase, ArrowRight, Leaf, MapPin, Bug, ChevronRight, Clock, Sparkles } from "lucide-react";
import LocationSection from "@/components/LocationSection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardPage = () => {
  const { user, isAdmin, isGovtOfficer } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const page = await forumApi.getMyRecentPosts(0, 5);
        setPosts(page.content);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const roleLabel = isAdmin ? "Admin" : isGovtOfficer ? "GOVT Officer" : "Farmer";
  const RoleIcon = isAdmin ? Shield : isGovtOfficer ? Briefcase : User;

  const quickLinks = [
    { to: "/ml/disease", icon: Bug, label: "Disease Detection", desc: "AI-powered crop analysis", color: "text-emerald-600 bg-emerald-500/10" },
    { to: "/forum", icon: MessageSquare, label: "Community Forum", desc: "Ask & share knowledge", color: "text-blue-600 bg-blue-500/10" },
    { to: "/map", icon: MapPin, label: "Officer Map", desc: "Find nearby officers", color: "text-amber-600 bg-amber-500/10" },
    { to: "/requests", icon: Sparkles, label: "My Requests", desc: "Track your cases", color: "text-purple-600 bg-purple-500/10" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* ═══ Welcome Header ═══ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border/50 p-6 sm:p-8">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary mb-1 flex items-center gap-1.5">
                  <Leaf className="h-4 w-4" />
                  Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{user?.username}</h1>
                <p className="text-muted-foreground mt-1">Here's what's happening with your AgriVerse account.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full ${isAdmin || isGovtOfficer ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <RoleIcon className="h-4 w-4" />
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
          {/* Decorative */}
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
        </div>

        {/* ═══ Quick Links ═══ */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="group">
                <Card className="h-full border-border/50 transition-all duration-200 hover:border-primary/30 hover:shadow-md group-hover:scale-[1.02]">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${link.color}`}>
                      <link.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{link.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══ Location Section ═══ */}
        <LocationSection />

        {/* ═══ Main Grid ═══ */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Account Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                Account Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {user?.username?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold">{user?.username}</div>
                  <div className="text-sm text-muted-foreground">{user?.email}</div>
                </div>
              </div>
              <Button variant="outline" className="w-full gap-2" asChild>
                <Link to="/profile">
                  View Profile
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Posts */}
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  </div>
                  Recent Forum Posts
                </CardTitle>
                <Button variant="ghost" size="sm" className="gap-1 text-xs" asChild>
                  <Link to="/forum">
                    View All <ChevronRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
              <CardDescription>Your latest contributions to the community</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && posts.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                    <MessageSquare className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">No posts yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start a discussion in the community forum</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/forum">Go to Forum</Link>
                  </Button>
                </div>
              )}

              {!loading && posts.length > 0 && (
                <div className="space-y-2">
                  {posts.map((p) => (
                    <Link
                      key={p.id}
                      to={`/forum/posts/${p.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <MessageSquare className="h-4 w-4 text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span className="capitalize">{p.topicName}</span>
                          <span>•</span>
                          <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
