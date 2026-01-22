import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { requestsApi, UserRequest, UserRequestMessage } from "@/api/requests";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildFileUrl } from "@/api/util";

// shadcn dialog + select
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ✅ Sheet for mobile “Info” panel
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Info, PanelLeftClose, PanelLeftOpen, MapPin } from "lucide-react"; // ✅ NEW

type OfficerOption = {
  username: string;
  identificationNumber?: string | null;
};

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span
      className={`text-xs rounded-full px-2 py-1 border ${status === "OPEN"
        ? "bg-muted/30"
        : status === "IN_PROGRESS"
          ? "bg-primary/10"
          : "bg-muted/50"
        }`}
    >
      {status ?? "—"}
    </span>
  );
}

function RequestInfoPanel({
  requestId,
  req,
  isGovtOfficer,
  userUsername,
  onTake,
  onArchive,
  onOpenForward,
  descExpanded,
  setDescExpanded,
}: {
  requestId: number;
  req: UserRequest | null;
  isGovtOfficer: boolean;
  userUsername?: string;
  onTake: () => void;
  onArchive: () => void;
  onOpenForward: () => void;
  descExpanded: boolean;
  setDescExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const status = req?.status;
  const imageSrc = buildFileUrl(req?.imageUrl);

  const creatorName =
    req?.createdBy?.username ?? req?.createdByUsername ?? "Unknown";
  const creatorEmail = req?.createdBy?.email ?? "";
  const assignedName =
    req?.assignedOfficer?.username ?? req?.assignedOfficerUsername ?? "";
  const createdAt = formatTime((req as any)?.createdAt);
  const takenAt = formatTime((req as any)?.takenAt);
  const archivedAt = formatTime((req as any)?.archivedAt);

  const descText = req?.description ?? "—";
  const descIsLong = descText.length > 320;
  const descPreview = descIsLong ? `${descText.slice(0, 320)}…` : descText;

  return (
    <div className="space-y-4">
      {/* Header / summary */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-semibold">Request #{requestId}</div>
          <StatusPill status={status as any} />
        </div>
        <div className="text-sm text-muted-foreground">{req?.category ?? "—"}</div>
      </div>

      {/* Actions */}
      {isGovtOfficer && (
        <div className="flex flex-wrap gap-2">
          {status === "OPEN" && (
            <Button variant="outline" onClick={onTake}>
              Take
            </Button>
          )}

          {status === "IN_PROGRESS" && (
            <>
              <Button variant="outline" onClick={onOpenForward}>
                Forward
              </Button>
              <Button variant="outline" onClick={onArchive}>
                Archive
              </Button>
            </>
          )}

          {status === "ARCHIVED" && (
            <Button variant="outline" disabled>
              Archived
            </Button>
          )}
        </div>
      )}

      {/* Creator */}
      <div className="rounded-xl border border-border/50 p-3">
        <div className="text-xs text-muted-foreground">Created by</div>
        <div className="font-medium">{creatorName}</div>
        {creatorEmail && (
          <div className="text-sm text-muted-foreground">{creatorEmail}</div>
        )}
      </div>

      {/* Assigned */}
      <div className="rounded-xl border border-border/50 p-3 relative group">
        <div className="text-xs text-muted-foreground">Assigned officer</div>
        <div className="font-medium">{assignedName || "Not assigned"}</div>
        {req?.assignedOfficer?.identificationNumber && (
          <div className="text-sm text-muted-foreground">
            ID: {req.assignedOfficer.identificationNumber}
          </div>
        )}
        {assignedName && assignedName !== "Not assigned" && assignedName !== "Unknown" && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-3 right-3 h-7 text-xs gap-1"
            onClick={() => navigate(`/map?username=${encodeURIComponent(assignedName)}`)}
            title="Locate officer on map"
          >
            <MapPin className="h-3 w-3" />
            Map
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border/50 p-3 space-y-1">
        <div className="text-xs text-muted-foreground">Timeline</div>
        <div className="text-sm">
          <span className="text-muted-foreground">Created: </span>
          {createdAt || "—"}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Taken: </span>
          {takenAt || "—"}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Archived: </span>
          {archivedAt || "—"}
        </div>
      </div>

      {/* Description (collapsed/expandable) */}
      <div className="rounded-xl border border-border/50 p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs text-muted-foreground">Description</div>

          {descIsLong && (
            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        <div
          role={descIsLong ? "button" : undefined}
          tabIndex={descIsLong ? 0 : -1}
          onClick={() => {
            if (descIsLong) setDescExpanded((v) => !v);
          }}
          onKeyDown={(e) => {
            if (!descIsLong) return;
            if (e.key === "Enter" || e.key === " ") setDescExpanded((v) => !v);
          }}
          className={[
            "text-sm whitespace-pre-wrap",
            descIsLong ? "cursor-pointer select-text" : "",
          ].join(" ")}
        >
          {descExpanded ? descText : descPreview}
        </div>

        {(req?.state || req?.district) && (
          <div className="text-xs text-muted-foreground mt-2">
            {req?.state ?? ""}
            {req?.state && req?.district ? ", " : ""}
            {req?.district ?? ""}
          </div>
        )}
      </div>

      {/* Images (Gallery) */}
      {(() => {
        const urls = req?.imageUrls?.length
          ? req.imageUrls
          : req?.imageUrl
            ? [req.imageUrl]
            : [];

        if (urls.length === 0) return null;

        return (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Attachments ({urls.length})</div>
            <div className={`grid gap-2 ${urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {urls.map((url, i) => (
                <a
                  key={i}
                  href={buildFileUrl(url)}
                  target="_blank"
                  rel="noreferrer"
                  className="block relative rounded-lg border border-border/50 bg-muted/20 overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img
                    src={buildFileUrl(url)}
                    alt={`Attachment ${i + 1}`}
                    className="w-full h-24 object-cover"
                  />
                </a>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground">Click to view full size</div>
          </div>
        );
      })()}

      {isGovtOfficer && status === "OPEN" && userUsername && (
        <div className="text-xs text-muted-foreground">
          Tip: Tap <b>Take</b> to start replying.
        </div>
      )}
    </div>
  );
}

export default function RequestChatPage() {
  const { id } = useParams();
  const requestId = useMemo(() => Number(id), [id]);

  const { user, isGovtOfficer } = useAuth();

  const [req, setReq] = useState<UserRequest | null>(null);
  const [msgs, setMsgs] = useState<UserRequestMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const [descExpanded, setDescExpanded] = useState(false);

  const [forwardOpen, setForwardOpen] = useState(false);
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<string>("");
  const [forwarding, setForwarding] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ✅ NEW: desktop info collapse state
  const [infoCollapsed, setInfoCollapsed] = useState(false);

  const load = async () => {
    const [reqRes, msgRes] = await Promise.all([
      requestsApi.getById(requestId),
      requestsApi.messages(requestId, 0, 200),
    ]);
    setReq(reqRes);
    setMsgs(msgRes.content ?? []);
  };

  useEffect(() => {
    if (!requestId) return;

    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();

    const t = window.setInterval(() => load().catch(() => { }), 4000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const status = req?.status;
  const isArchived = status === "ARCHIVED";
  const officerMustTake = isGovtOfficer && status === "OPEN";

  const send = async () => {
    const m = text.trim();
    if (!m) return;
    setText("");
    await requestsApi.sendMessage(requestId, m);
    await load();
  };

  const archive = async () => {
    const updated = await requestsApi.archive(requestId);
    setReq(updated);
  };

  const take = async () => {
    const updated = await requestsApi.take(requestId);
    setReq(updated);
  };

  const openForward = async () => {
    setForwardOpen(true);
    setSelectedOfficer("");

    if (officers.length === 0) {
      const list: OfficerOption[] = await requestsApi.listGovtOfficers();
      const filtered = (list ?? []).filter((o) => o.username !== user?.username);
      setOfficers(filtered);
    }
  };

  const forward = async () => {
    if (!selectedOfficer) return;
    setForwarding(true);
    try {
      const updated = await requestsApi.forward(requestId, selectedOfficer);
      setReq(updated);
      setForwardOpen(false);
      await load();
    } finally {
      setForwarding(false);
    }
  };

  const creatorName = req?.createdBy?.username ?? req?.createdByUsername ?? "Unknown";

  return (
    // ✅ NEW: use dvh so it fits mobile browser better
    <div className="container mx-auto px-4 py-4 sm:py-6 h-[calc(100dvh-65px)]">
      {/* ✅ NEW: grid becomes 1-col when infoCollapsed */}
      <div
        className={[
          "h-full grid gap-4 overflow-hidden",
          infoCollapsed
            ? "grid-cols-1"
            : "grid-cols-1 lg:grid-cols-[360px_1fr]",
        ].join(" ")}
      >
        {/* LEFT: Sidebar (desktop only) */}
        {!infoCollapsed && (
          <Card className="border-border/50 h-full overflow-y-auto lg:sticky lg:top-6 hidden lg:block">
            <CardContent className="p-4">
              <RequestInfoPanel
                requestId={requestId}
                req={req}
                isGovtOfficer={isGovtOfficer}
                userUsername={user?.username}
                onTake={take}
                onArchive={archive}
                onOpenForward={openForward}
                descExpanded={descExpanded}
                setDescExpanded={setDescExpanded}
              />
            </CardContent>
          </Card>
        )}

        {/* RIGHT: Chat (mobile + desktop) */}
        <Card className="border-border/50 flex flex-col h-full min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border/50 py-2 px-3 sm:py-3 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{creatorName}</div>
                  <div className="hidden sm:block">
                    <StatusPill status={status as any} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {req?.category ?? "—"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {isArchived
                    ? "Chat archived"
                    : officerMustTake
                      ? "Take the request to reply"
                      : "Live"}
                </div>

                {/* ✅ NEW: Desktop collapse toggle (only lg+) */}
                <div className="hidden lg:block">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setInfoCollapsed((v) => !v)}
                    title={infoCollapsed ? "Show info" : "Hide info"}
                  >
                    {infoCollapsed ? (
                      <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Mobile Info Button (opens sheet) */}
                <div className="lg:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9">
                        <Info className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      className="w-[92vw] sm:w-[420px] overflow-y-auto"
                    >
                      <SheetHeader className="mb-4">
                        <SheetTitle>Request info</SheetTitle>
                      </SheetHeader>

                      <RequestInfoPanel
                        requestId={requestId}
                        req={req}
                        isGovtOfficer={isGovtOfficer}
                        userUsername={user?.username}
                        onTake={take}
                        onArchive={archive}
                        onOpenForward={openForward}
                        descExpanded={descExpanded}
                        setDescExpanded={setDescExpanded}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground sm:hidden mt-1 leading-tight">

              {isArchived
                ? "Chat archived"
                : officerMustTake
                  ? "Take the request to reply"
                  : "Live"}{" "}
              <span className="mx-1">•</span> <StatusPill status={status as any} />
            </div>
          </CardHeader>

          {/* Messages area */}
          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="h-full overflow-y-auto px-4 py-4 space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : msgs.length === 0 ? (
                <div className="text-sm text-muted-foreground">No messages yet.</div>
              ) : (
                msgs.map((m) => {
                  const mine = m.senderUsername === user?.username;

                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[88%] sm:max-w-[70%] space-y-1">
                        <div
                          className={`rounded-2xl px-4 py-2 text-sm border border-border/50 ${mine ? "bg-primary text-primary-foreground" : "bg-muted/30"
                            }`}
                        >
                          <div className="whitespace-pre-wrap">{m.message}</div>
                        </div>

                        <div
                          className={`text-[11px] text-muted-foreground ${mine ? "text-right" : "text-left"
                            }`}
                        >
                          {m.senderUsername}
                          {m.createdAt ? ` • ${formatTime(m.createdAt)}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={bottomRef} />
            </div>
          </CardContent>

          {/* Composer */}
          <div className="border-t border-border/50 p-2 sm:p-3">

            <div className="flex gap-2 items-end">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  isArchived
                    ? "Chat archived"
                    : officerMustTake
                      ? "Take the request to reply"
                      : "Write a message..."
                }
                disabled={isArchived || officerMustTake}
                className="min-h-[44px] max-h-[160px]"
              />
              <Button
                onClick={send}
                disabled={!text.trim() || isArchived || officerMustTake}
                className="h-[44px]"
              >
                Send
              </Button>
            </div>

            {!isArchived && !officerMustTake && (
              <div className="text-[11px] text-muted-foreground mt-2">
                Tip: Press Enter for a new line; click Send to submit.
              </div>
            )}
          </div>
        </Card>

        {/* Forward Modal */}
        <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Forward request</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Select the govt officer you want to forward this request to.
              </div>

              <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select officer..." />
                </SelectTrigger>
                <SelectContent>
                  {officers.map((o) => (
                    <SelectItem key={o.username} value={o.username}>
                      {o.username}
                      {o.identificationNumber
                        ? ` (ID: ${o.identificationNumber})`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {officers.length === 0 && (
                <div className="text-sm text-muted-foreground">No other officers found.</div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setForwardOpen(false)}>
                Cancel
              </Button>
              <Button onClick={forward} disabled={!selectedOfficer || forwarding}>
                {forwarding ? "Forwarding..." : "Forward"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
