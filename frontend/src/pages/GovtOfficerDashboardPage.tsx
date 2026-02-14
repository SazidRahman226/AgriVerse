import { useEffect, useState } from "react";
import BackButton from "@/components/BackButton";
import apiClient from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Inbox, MapPin, User, Clock, FileText, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type UserRequest = {
  id: number;
  createdByUsername: string;
  assignedOfficerUsername?: string | null;
  assignedOfficerIdentificationNumber?: string | null;
  category: string;
  description: string;
  imageUrl?: string | null;
  state?: string | null;
  district?: string | null;
  createdAt: string;
};

export default function GovtOfficerDashboardPage() {
  const { isGovtOfficer, user } = useAuth();
  const [items, setItems] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/user-requests/officer/queue", {
        params: { page: 0, size: 20 },
      });
      setItems(res.data.content ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isGovtOfficer) return;
    fetchQueue();
  }, [isGovtOfficer]);

  if (!isGovtOfficer) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <BackButton />
        {/* ═══ Header ═══ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-primary/5 to-transparent border border-border/50 p-6 sm:p-8">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Briefcase className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Officer Dashboard</h1>
                  <p className="text-muted-foreground mt-0.5">
                    Welcome, <span className="font-medium text-foreground">{user?.username}</span> — manage your assigned requests.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full bg-primary/10 text-primary">
                  <Inbox className="h-4 w-4" />
                  {items.length} Request{items.length !== 1 && "s"}
                </span>
                <Button variant="outline" size="sm" className="gap-2" onClick={fetchQueue} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-blue-500/5 blur-2xl" />
        </div>

        {/* ═══ Queue ═══ */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No assigned requests</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                New requests from farmers will appear here when they are forwarded to you.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <Link key={r.id} to={`/requests/${r.id}`} className="block group">
                <Card className="border-border/50 transition-all duration-200 hover:border-primary/30 hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {r.category}
                              <span className="text-xs font-normal text-muted-foreground">#{r.id}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {r.createdByUsername}
                          </span>
                          {(r.district || r.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {r.district || "-"}, {r.state || "-"}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
