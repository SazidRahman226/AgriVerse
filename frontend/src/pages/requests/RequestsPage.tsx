import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestsApi, UserRequest } from "@/api/requests";
import { useAuth } from "@/context/AuthContext";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import {
  RefreshCw,
  Plus,
  Search,
  Inbox,
  Archive,
  UserCheck,
  ChevronRight,
} from "lucide-react";

type SpringPage<T> = { content: T[] };

function StatusBadge({ status }: { status: UserRequest["status"] }) {
  const label =
    status === "OPEN" ? "Open" : status === "IN_PROGRESS" ? "In progress" : "Archived";

  // smaller, calmer pills on mobile
  const variant =
    status === "OPEN" ? "secondary" : status === "IN_PROGRESS" ? "default" : "outline";

  return (
    <Badge
      variant={variant as any}
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
    >
      {label}
    </Badge>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function contains(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function filterBySearch(list: UserRequest[], q: string) {
  const query = q.trim();
  if (!query) return list;

  // Description is NOT shown, but keeping it searchable is still useful.
  // If you don’t want that, remove r.description from the blob.
  return list.filter((r) => {
    const blob = [
      String(r.id ?? ""),
      r.category ?? "",
      r.description ?? "",
      r.createdByUsername ?? "",
      (r as any).assignedOfficerUsername ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    return contains(blob, query);
  });
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/60 bg-card/50 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2 w-full">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-60" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-8 text-center bg-card/30">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="font-medium">{title}</div>
      {hint ? <div className="mt-1 text-sm text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function TabLabel({
  icon,
  text,
  count,
}: {
  icon: React.ReactNode;
  text: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hidden sm:inline-flex">{icon}</span>
      <span>{text}</span>
      <Badge variant="secondary" className="ml-1 px-2 py-0.5 rounded-full">
        {count}
      </Badge>
    </span>
  );
}

function RequestListItem({
  r,
  metaLine,
  onOpen,
}: {
  r: UserRequest;
  metaLine: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="
        w-full text-left
        rounded-xl border border-border/60 bg-card/50
        px-4 py-3
        hover:bg-card/70 transition-colors
        active:scale-[0.99]
      "
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-medium truncate">
              <span className="text-muted-foreground">#</span>
              {r.id} <span className="text-muted-foreground">·</span>{" "}
              {r.category || "Uncategorized"}
            </div>
            <StatusBadge status={r.status} />
          </div>

          {/* description intentionally not shown */}
          <div className="mt-1 text-xs text-muted-foreground truncate">{metaLine}</div>
        </div>

        {/* Small action affordance (feels like inbox) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:inline text-xs text-muted-foreground">Chat</div>
          <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function RequestsPage() {
  const { isGovtOfficer } = useAuth();
  const navigate = useNavigate();

  // user data
  const [userActive, setUserActive] = useState<UserRequest[]>([]);
  const [userArchived, setUserArchived] = useState<UserRequest[]>([]);

  // officer data
  const [queue, setQueue] = useState<UserRequest[]>([]);
  const [assigned, setAssigned] = useState<UserRequest[]>([]);
  const [officerArchived, setOfficerArchived] = useState<UserRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadUser = async () => {
    const mine: SpringPage<UserRequest> = await requestsApi.myRequests(0, 50);
    const mineContent = mine.content ?? [];
    setUserActive(mineContent.filter((r) => r.status !== "ARCHIVED"));

    try {
      const arch: SpringPage<UserRequest> = await (requestsApi as any).myArchived(0, 50);
      setUserArchived(arch.content ?? []);
    } catch {
      setUserArchived(mineContent.filter((r) => r.status === "ARCHIVED"));
    }
  };

  const loadOfficer = async () => {
    const q: SpringPage<UserRequest> = await requestsApi.officerQueue(0, 50);
    setQueue(q.content ?? []);

    const a: SpringPage<UserRequest> = await (requestsApi as any).officerAssigned(0, 50);
    setAssigned(a.content ?? []);

    const ar: SpringPage<UserRequest> = await (requestsApi as any).officerArchived(0, 50);
    setOfficerArchived(ar.content ?? []);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      if (isGovtOfficer) await loadOfficer();
      else await loadUser();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGovtOfficer]);

  const openChat = (id: number) => navigate(`/requests/${id}`);

  const takeAndOpen = async (id: number) => {
    await requestsApi.take(id);
    openChat(id);
  };

  const filtered = useMemo(() => {
    return {
      queue: filterBySearch(queue, search),
      assigned: filterBySearch(assigned, search),
      officerArchived: filterBySearch(officerArchived, search),
      userActive: filterBySearch(userActive, search),
      userArchived: filterBySearch(userArchived, search),
    };
  }, [queue, assigned, officerArchived, userActive, userArchived, search]);

  const pageTitle = isGovtOfficer ? "Officer requests" : "My requests";
  const pageHint = isGovtOfficer
    ? "Take requests, reply in chat, archive solved cases."
    : "Create requests, chat with the officer, review archived solutions.";

  return (
    <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6">
      {/* Compact sticky top controls (mobile friendly) */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-semibold truncate">{pageTitle}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-2">
              {pageHint}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative w-full sm:w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by id, crop, user…"
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={refresh}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {!isGovtOfficer && (
              <Button onClick={() => navigate("/requests/new")} className="gap-2">
                <Plus className="h-4 w-4" />
                <span>Create</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mt-6">
        {isGovtOfficer ? (
          <Tabs defaultValue="queue">
            <TabsList className="w-full sm:w-auto flex flex-wrap justify-start">
              <TabsTrigger value="queue">
                <TabLabel
                  icon={<Inbox className="h-4 w-4" />}
                  text="Queue"
                  count={filtered.queue.length}
                />
              </TabsTrigger>
              <TabsTrigger value="assigned">
                <TabLabel
                  icon={<UserCheck className="h-4 w-4" />}
                  text="Assigned"
                  count={filtered.assigned.length}
                />
              </TabsTrigger>
              <TabsTrigger value="archived">
                <TabLabel
                  icon={<Archive className="h-4 w-4" />}
                  text="Archived"
                  count={filtered.officerArchived.length}
                />
              </TabsTrigger>
            </TabsList>

            <Separator className="my-4" />

            <TabsContent value="queue" className="mt-0">
              {loading ? (
                <ListSkeleton />
              ) : filtered.queue.length === 0 ? (
                <EmptyState
                  title={search ? "No results in Queue" : "No unassigned requests"}
                  hint={search ? "Try a different keyword." : "New requests will show up here."}
                />
              ) : (
                <div className="space-y-2">
                  {filtered.queue.map((r) => (
                    <div key={r.id} className="space-y-2">
                      <RequestListItem
                        r={r}
                        metaLine={
                          <>
                            <span className="font-medium text-muted-foreground">From:</span>{" "}
                            {r.createdByUsername || "Unknown"}{" "}
                            <span className="text-muted-foreground">·</span> {fmt(r.createdAt)}
                          </>
                        }
                        // taking should still be explicit, so we take then open
                        onOpen={() => openChat(r.id)}

                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="assigned" className="mt-0">
              {loading ? (
                <ListSkeleton />
              ) : filtered.assigned.length === 0 ? (
                <EmptyState
                  title={search ? "No results in Assigned" : "No assigned requests"}
                  hint={search ? "Try a different keyword." : "Requests you take will appear here."}
                />
              ) : (
                <div className="space-y-2">
                  {filtered.assigned.map((r) => (
                    <RequestListItem
                      key={r.id}
                      r={r}
                      metaLine={
                        <>
                          <span className="font-medium text-muted-foreground">From:</span>{" "}
                          {r.createdByUsername || "Unknown"}{" "}
                          {r.createdAt ? (
                            <>
                              <span className="text-muted-foreground">·</span> {fmt(r.createdAt)}
                            </>
                          ) : null}
                        </>
                      }
                      onOpen={() => openChat(r.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="archived" className="mt-0">
              {loading ? (
                <ListSkeleton />
              ) : filtered.officerArchived.length === 0 ? (
                <EmptyState
                  title={search ? "No results in Archived" : "No archived requests"}
                  hint={search ? "Try a different keyword." : "Solved/closed items will appear here."}
                />
              ) : (
                <div className="space-y-2">
                  {filtered.officerArchived.map((r) => (
                    <RequestListItem
                      key={r.id}
                      r={r}
                      metaLine={
                        <>
                          <span className="font-medium text-muted-foreground">Archived:</span>{" "}
                          {fmt((r as any).archivedAt)}
                        </>
                      }
                      onOpen={() => openChat(r.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs defaultValue="active">
            <TabsList className="w-full sm:w-auto flex flex-wrap justify-start">
              <TabsTrigger value="active">
                <TabLabel
                  icon={<Inbox className="h-4 w-4" />}
                  text="Active"
                  count={filtered.userActive.length}
                />
              </TabsTrigger>
              <TabsTrigger value="archived">
                <TabLabel
                  icon={<Archive className="h-4 w-4" />}
                  text="Archived"
                  count={filtered.userArchived.length}
                />
              </TabsTrigger>
            </TabsList>

            <Separator className="my-4" />

            <TabsContent value="active" className="mt-0">
              {loading ? (
                <ListSkeleton />
              ) : filtered.userActive.length === 0 ? (
                <EmptyState
                  title={search ? "No results in Active" : "No active requests"}
                  hint={
                    search
                      ? "Try a different keyword."
                      : "Tap “Create” to send a new request to an officer."
                  }
                />
              ) : (
                <div className="space-y-2">
                  {filtered.userActive.map((r) => (
                    <RequestListItem
                      key={r.id}
                      r={r}
                      metaLine={
                        <>
                          <span className="font-medium text-muted-foreground">Created:</span>{" "}
                          {fmt(r.createdAt)}{" "}
                          <span className="text-muted-foreground">·</span>{" "}
                          {r.assignedOfficerUsername ? (
                            <>
                              <span className="font-medium text-muted-foreground">Officer:</span>{" "}
                              {r.assignedOfficerUsername}
                            </>
                          ) : (
                            "Waiting for officer"
                          )}
                        </>
                      }
                      onOpen={() => openChat(r.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="archived" className="mt-0">
              {loading ? (
                <ListSkeleton />
              ) : filtered.userArchived.length === 0 ? (
                <EmptyState
                  title={search ? "No results in Archived" : "No archived requests"}
                  hint={search ? "Try a different keyword." : "Your solved requests will appear here."}
                />
              ) : (
                <div className="space-y-2">
                  {filtered.userArchived.map((r) => (
                    <RequestListItem
                      key={r.id}
                      r={r}
                      metaLine={
                        <>
                          <span className="font-medium text-muted-foreground">Archived:</span>{" "}
                          {fmt((r as any).archivedAt)}
                          {r.assignedOfficerUsername ? (
                            <>
                              {" "}
                              <span className="text-muted-foreground">·</span>{" "}
                              <span className="font-medium text-muted-foreground">Solved by:</span>{" "}
                              {r.assignedOfficerUsername}
                            </>
                          ) : null}
                        </>
                      }
                      onOpen={() => openChat(r.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
