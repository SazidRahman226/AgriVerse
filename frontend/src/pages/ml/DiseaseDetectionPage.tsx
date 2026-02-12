import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  mlAdvice,
  mlPredict,
  mlForwardToGovtOfficer,
  mlForwardToNearestOfficer,
  MlPredictionResponse,
} from "@/api/ml";

import { mapApi, Officer } from "@/api/map";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  MapPin,
  Users,
  Upload,
  Camera,
  Image as ImageIcon,
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  BarChart3,
  Leaf,
  XCircle,
  Navigation,
  X,
  Trash2,
  Crop,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { AxiosError } from "axios";

// ─── Leaflet ───
import { MapContainer, TileLayer, Marker, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Cropper ───
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const officerIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const nearestIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ─── Steps ───
const STEPS = [
  { key: "upload", label: "Upload Images", icon: Upload },
  { key: "predict", label: "Predict", icon: Sparkles },
  { key: "advice", label: "Advice", icon: MessageSquare },
  { key: "forward", label: "Forward", icon: Send },
] as const;

type Step = (typeof STEPS)[number]["key"];

function getStepIndex(step: Step) {
  return STEPS.findIndex((s) => s.key === step);
}

function formatAdvice(text: string) {
  return text.replace(/(\d+\))/g, "\n$1").replace(/\n+/g, "\n\n").trim();
}

function pct(x?: number) {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function pctNum(x?: number) {
  if (x == null || Number.isNaN(x)) return 0;
  return Math.round(x * 100);
}

/** Split "Rice___Blast" → { crop: "Rice", disease: "Blast" } */
function parsePrediction(pred: any): { crop: string; disease: string } {
  if (typeof pred !== "string") return { crop: "—", disease: "—" };
  const parts = pred.split("___");
  if (parts.length >= 2) return { crop: parts[0], disease: parts.slice(1).join(" ") };
  return { crop: pred, disease: "—" };
}

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
}

/**
 * Compress an image File/Blob client-side.
 * Resizes to fit within maxDim and outputs JPEG at given quality.
 * This prevents HTTP 413 (Payload Too Large) from raw camera photos.
 */
function compressImage(
  file: File | Blob,
  maxDim = 1200,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only downscale, never upscale
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file as File); return; }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file as File); return; }
          const name = (file as File).name || "image.jpg";
          const compressed = new File([blob], name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
          });
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}

/**
 * Normalize ML predict response so the rest of the UI can be consistent.
 * Supports both "flat" and "nested" shapes.
 */
function normalizePredictResponse(res: any): {
  prediction: MlPredictionResponse | null;
  isLeaf: boolean | null;
  reason?: string;
  error?: string;
} {
  const error = res?.prediction?.error || res?.error;
  const isLeaf = res?.prediction?.is_leaf ?? res?.is_leaf ?? null;
  const reason = res?.prediction?.reason || res?.reason;

  if (error) return { prediction: null, isLeaf, reason, error: String(error) };

  const predObj =
    res?.prediction && typeof res.prediction === "object" ? res.prediction : res;

  return { prediction: predObj ?? null, isLeaf, reason };
}

// ═══════════════════════════════════════════════════════
// MiniMap shown inside the forward dialog
// ═══════════════════════════════════════════════════════
const OfficerMiniMap = memo(function OfficerMiniMap({ open }: { open: boolean }) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const officersCacheRef = useRef<Officer[] | null>(null);

  useEffect(() => {
    if (!open) return;

    if (officersCacheRef.current && officersCacheRef.current.length > 0) {
      setOfficers(officersCacheRef.current);
    } else {
      setLoading(true);
      mapApi
        .getOfficers()
        .then((data) => {
          officersCacheRef.current = data;
          setOfficers(data);
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }

    if (navigator.geolocation) {
      setLocLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPos([pos.coords.latitude, pos.coords.longitude]);
          setLocLoading(false);
        },
        () => {
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    }
  }, [open]);

  const nearest = useMemo(() => {
    if (!userPos || officers.length === 0) return null;
    let best: (Officer & { dist: number }) | null = null;
    for (const o of officers) {
      const d = haversineKm(userPos[0], userPos[1], o.latitude, o.longitude);
      if (!best || d < best.dist) best = { ...o, dist: d };
    }
    return best;
  }, [officers, userPos]);

  const center: [number, number] = useMemo(() => {
    if (userPos) return userPos;
    if (officers.length > 0) return [officers[0].latitude, officers[0].longitude];
    return [23.8103, 90.4125];
  }, [userPos, officers]);

  const zoom = useMemo(() => {
    if (nearest && userPos) {
      if (nearest.dist < 5) return 13;
      if (nearest.dist < 20) return 11;
      if (nearest.dist < 50) return 10;
      return 8;
    }
    return 8;
  }, [nearest, userPos]);

  if (!open) return null;

  if (loading) {
    return (
      <div className="w-full h-44 rounded-lg bg-muted/50 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading map…</span>
      </div>
    );
  }

  if (officers.length === 0) {
    return (
      <div className="w-full h-32 rounded-lg bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 mr-2 opacity-50" />
        No officers with locations available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="w-full h-48 rounded-lg overflow-hidden border border-border/50 relative">
        {locLoading && (
          <div className="absolute top-2 left-2 z-[999] px-2 py-1 rounded bg-background/80 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Getting your location…
          </div>
        )}

        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={false}
          dragging={true}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {userPos && (
            <>
              <CircleMarker
                center={userPos}
                radius={14}
                pathOptions={{
                  color: "#4285F4",
                  fillColor: "#4285F4",
                  fillOpacity: 0.15,
                  weight: 1,
                  opacity: 0.3,
                }}
              />
              <CircleMarker
                center={userPos}
                radius={6}
                pathOptions={{ color: "white", fillColor: "#4285F4", fillOpacity: 1, weight: 2 }}
              >
                <Popup>Your location</Popup>
              </CircleMarker>
            </>
          )}
          {officers.map((o) => (
            <Marker
              key={o.id}
              position={[o.latitude, o.longitude]}
              icon={nearest && o.id === nearest.id ? nearestIcon : officerIcon}
            >
              <Popup>
                <strong>{o.username}</strong>
                <br />
                {o.email}
                {nearest && o.id === nearest.id && userPos && (
                  <>
                    <br />
                    <em>{formatDist(nearest.dist)} away</em>
                  </>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {nearest && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-sm font-bold shrink-0">
            {nearest.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{nearest.username}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium whitespace-nowrap">
                Nearest
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{nearest.email}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Navigation className="h-3 w-3" />
              {formatDist(nearest.dist)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════
export default function DiseaseDetectionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ─── State ───
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [prediction, setPrediction] = useState<MlPredictionResponse | null>(null);
  const [isLeafDetected, setIsLeafDetected] = useState<boolean | null>(null);
  const [notLeaf, setNotLeaf] = useState<string | null>(null);

  const [advice, setAdvice] = useState("—");
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceReady, setAdviceReady] = useState(false);

  const [busyPredict, setBusyPredict] = useState(false);
  const [busyForward, setBusyForward] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardingMode, setForwardingMode] = useState<"POOL" | "NEAREST" | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ─── Crop Dialog State ───
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const cropperRef = useRef<any>(null);

  // ─── Derived ───
  const parsed = useMemo(() => parsePrediction(prediction?.prediction), [prediction]);
  const top5 = prediction?.topk?.slice(0, 5) ?? [];
  const allPredictions = prediction?.allPredictions ?? [];

  // ─── Cleanup: revoke object URLs on unmount ───
  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  // ─── Current step ───
  const currentStep: Step = useMemo(() => {
    if (adviceReady) return "forward";
    if (prediction) return "advice";
    if (files.length > 0) return "predict";
    return "upload";
  }, [files, prediction, adviceReady]);

  // ─── Helpers ───
  const resetAll = useCallback(() => {
    setPrediction(null);
    setIsLeafDetected(null);
    setNotLeaf(null);

    setAdvice("—");
    setAdviceOpen(false);
    setAdviceReady(false);
    setAdviceLoading(false);

    setLocationError(false);

    // Close forward UI if user changes files / resets
    setForwardDialogOpen(false);
    setForwardingMode(null);
  }, []);

  const revokeAllPreviews = useCallback((urls: string[]) => {
    urls.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch { }
    });
  }, []);

  const clearAllFiles = useCallback(() => {
    revokeAllPreviews(previewUrls);
    setFiles([]);
    setPreviewUrls([]);
    resetAll();
  }, [previewUrls, resetAll, revokeAllPreviews]);

  const onAddFiles = useCallback(
    async (newFiles: FileList | null) => {
      if (!newFiles || newFiles.length === 0) return;
      const raw = Array.from(newFiles);

      // Compress all images to prevent 413 (Payload Too Large)
      const compressed = await Promise.all(raw.map((f) => compressImage(f)));

      setFiles((prev) => [...prev, ...compressed]);
      setPreviewUrls((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))]);

      // If user adds new images, previous results are no longer valid
      resetAll();
    },
    [resetAll]
  );

  const removeFile = useCallback(
    (index: number) => {
      setFiles((prev) => prev.filter((_, i) => i !== index));
      setPreviewUrls((prev) => {
        const urlToRemove = prev[index];
        if (urlToRemove) {
          try {
            URL.revokeObjectURL(urlToRemove);
          } catch { }
        }
        return prev.filter((_, i) => i !== index);
      });
      resetAll();
    },
    [resetAll]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) onAddFiles(e.dataTransfer.files);
    },
    [onAddFiles]
  );

  // ✅ NEW: Open camera explicitly
  const openCamera = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  // ─── Crop handler ───
  const applyCrop = useCallback(() => {
    if (cropIndex === null) return;
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas();
    if (!canvas) return;

    // Output as compressed JPEG to keep file size small
    canvas.toBlob(
      async (blob: Blob | null) => {
        if (!blob) return;

        const originalFile = files[cropIndex];
        const name = originalFile?.name || `cropped_${cropIndex}.jpg`;

        // Compress the cropped result
        const croppedFile = await compressImage(
          new File([blob], name, { type: "image/jpeg" })
        );

        // Replace file
        setFiles((prev) => prev.map((f, i) => (i === cropIndex ? croppedFile : f)));

        // Replace preview URL
        setPreviewUrls((prev) => {
          const oldUrl = prev[cropIndex!];
          if (oldUrl) {
            try { URL.revokeObjectURL(oldUrl); } catch { }
          }
          const newUrl = URL.createObjectURL(croppedFile);
          return prev.map((u, i) => (i === cropIndex ? newUrl : u));
        });

        // Invalidate old prediction since image changed
        resetAll();
        setCropIndex(null);
      },
      "image/jpeg",
      0.85
    );
  }, [cropIndex, files, resetAll]);

  const doPredict = useCallback(async () => {
    if (files.length === 0) return;

    setBusyPredict(true);
    resetAll();

    try {
      const res: any = await mlPredict(files);
      const norm = normalizePredictResponse(res);

      if (norm.error) throw new Error(norm.error);

      // Not a leaf
      if (norm.isLeaf === false) {
        setIsLeafDetected(false);
        const msg = norm.reason || "The uploaded image is not a plant leaf.";
        setNotLeaf(msg);
        toast({ title: "Not a Leaf", description: msg, variant: "destructive" });
        return;
      }

      // Leaf (or unknown but prediction returned)
      setIsLeafDetected(norm.isLeaf ?? true);
      if (!norm.prediction) throw new Error("Invalid prediction response");

      setPrediction(norm.prediction);
      setAdviceOpen(true);

      const { crop, disease } = parsePrediction(norm.prediction?.prediction);
      toast({ title: "Prediction Complete ✅", description: `${crop} — ${disease}` });
    } catch (e: any) {
      toast({
        title: "Prediction Failed",
        description: e?.message || "Prediction failed",
        variant: "destructive",
      });
    } finally {
      setBusyPredict(false);
    }
  }, [files, resetAll, toast]);

  const doAdvice = useCallback(async () => {
    if (!prediction?.prediction || !parsed.crop || !parsed.disease) return;

    setAdviceOpen(true);
    setAdviceLoading(true);
    setAdvice("Loading advice…");

    try {
      const res = await mlAdvice(parsed.crop, parsed.disease);
      setAdvice(res.answer ?? "No advice available");
      setAdviceReady(true);
      toast({ title: "AI Advice Ready ✅" });
    } catch {
      setAdvice("AI advice failed.");
      toast({ title: "Advice Failed", variant: "destructive" });
    } finally {
      setAdviceLoading(false);
    }
  }, [prediction, parsed.crop, parsed.disease, toast]);

  const permissionToForward = useMemo(() => {
    return (
      files.length > 0 &&
      !!prediction &&
      isLeafDetected !== false &&
      !prediction?.error &&
      adviceReady
    );
  }, [files.length, prediction, isLeafDetected, adviceReady]);

  const openForwardDialog = useCallback(() => {
    if (!permissionToForward) return;
    setLocationError(false);
    setForwardDialogOpen(true);
  }, [permissionToForward]);

  const doForward = useCallback(
    async (mode: "POOL" | "NEAREST") => {
      if (!permissionToForward) return;

      setForwardingMode(mode);
      setBusyForward(true);
      setLocationError(false);

      try {
        let res: any;
        if (mode === "NEAREST") {
          res = await mlForwardToNearestOfficer(parsed.crop, parsed.disease, advice, files);
        } else {
          res = await mlForwardToGovtOfficer(parsed.crop, parsed.disease, advice, files);
        }

        const id = res?.id;

        if (mode === "NEAREST" && res?.forwardMode === "POOL") {
          toast({
            title: "Forwarded to Pool",
            description: "No nearby officer found. Placed into the pool.",
          });
        } else {
          toast({
            title: "Forwarded Successfully ✅",
            description:
              mode === "NEAREST" ? "Sent to the nearest officer." : "Placed in the officer pool.",
          });
        }

        setForwardDialogOpen(false);
        if (id) navigate(`/requests/${id}`);
      } catch (error) {
        const axiosErr = error as AxiosError<any>;
        const data = axiosErr.response?.data;
        const status = axiosErr.response?.status;
        const msg =
          typeof data === "string" ? data : data?.message || data?.error || "Forward failed";

        const isLocationErr =
          (status === 400 || status === 422) &&
          typeof msg === "string" &&
          (msg.toLowerCase().includes("location") ||
            msg.toLowerCase().includes("latitude") ||
            msg.toLowerCase().includes("no officers"));

        if (isLocationErr) {
          setLocationError(true);
        } else {
          toast({ title: "Forward Failed", description: msg, variant: "destructive" });
        }
      } finally {
        setBusyForward(false);
        setForwardingMode(null);
      }
    },
    [permissionToForward, parsed.crop, parsed.disease, advice, files, toast, navigate]
  );

  // ─── Render ───
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* ═══ Header ═══ */}
        <BackButton className="-ml-1" />
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Leaf className="h-4 w-4" />
            AI-Powered Detection
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Plant Disease Detection
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Upload leaf images (one or many) and our AI will detect the crop, identify disease, and
            help you forward it to an officer.
          </p>
        </header>

        {/* ═══ Step Progress ═══ */}
        <div className="flex items-center justify-center gap-1 sm:gap-0">
          {STEPS.map((step, i) => {
            const idx = getStepIndex(currentStep);
            const done = i < idx;
            const active = i === idx;
            const StepIcon = step.icon;
            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${done
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : active
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110"
                        : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:block ${active ? "text-primary" : "text-muted-foreground"
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 mb-5 transition-colors duration-300 ${i < idx ? "bg-primary" : "bg-border"
                      }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ Main Content ═══ */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* ─── Left: Upload Panel ─── */}
          <div className="lg:col-span-3 space-y-5">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center py-12 px-6 text-center transition-all duration-300 cursor-pointer
                    ${isDragging ? "bg-primary/10 border-primary" : "bg-muted/30 hover:bg-muted/50"}
                  `}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <div
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 ${isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"
                      }`}
                  >
                    <Upload
                      className={`h-6 w-6 transition-colors ${isDragging ? "text-primary" : "text-primary/70"
                        }`}
                    />
                  </div>
                  <p className="font-semibold text-base mb-1">Click to upload or drag images here</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Support multiple files (JPG, PNG)
                  </p>

                  {/* ✅ NEW: Two buttons: Camera + Select Files */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent opening gallery
                        openCamera();
                      }}
                    >
                      <Camera className="h-4 w-4" />
                      Camera
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent parent click double-trigger
                        galleryInputRef.current?.click();
                      }}
                    >
                      <ImageIcon className="h-4 w-4" />
                      Select Files
                    </Button>
                  </div>
                </div>

                {/* Hidden Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onAddFiles(e.target.files)}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onAddFiles(e.target.files)}
                />
              </CardContent>

              {/* Thumbnails */}
              {files.length > 0 && (
                <div className="p-4 bg-background border-t border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">{files.length} images selected</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-destructive text-xs hover:bg-transparent hover:text-destructive/80"
                      onClick={clearAllFiles}
                    >
                      Clear all
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {previewUrls.map((url, i) => (
                      <div
                        key={i}
                        className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group"
                      >
                        <img
                          src={url}
                          alt="Preview"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setCropIndex(i)}
                          title="Click to crop"
                        />
                        <div className="absolute bottom-1 left-1 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <Crop className="h-3 w-3" />
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                          type="button"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add more button */}
                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      className="aspect-square rounded-lg border border-dashed border-border/70 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
                      type="button"
                    >
                      <Upload className="h-5 w-5 mb-1 opacity-50" />
                      <span className="text-[10px]">Add more</span>
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Predict Button */}
            {files.length > 0 && !prediction && !notLeaf && (
              <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2"
                  onClick={doPredict}
                  disabled={busyPredict}
                >
                  {busyPredict ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {busyPredict ? "Analyzing Images..." : "Run Prediction"}
                </Button>
              </div>
            )}

            {/* ═══ Not-a-Leaf Banner ═══ */}
            {notLeaf && (
              <Card className="border-destructive/30 bg-destructive/5 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-destructive">Prediction Failed</h3>
                      <p className="text-sm text-muted-foreground mt-1">{notLeaf}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-2"
                        onClick={clearAllFiles}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear & Try Again
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ─── Right: Results Panel ─── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Prediction results */}
            {prediction ? (
              <Card className="border-border/50 overflow-hidden animate-in slide-in-from-right-4 duration-500">
                <div className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-b border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Analysis Result
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center text-lg ${parsed.disease.toLowerCase().includes("healthy")
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                        }`}
                    >
                      {parsed.disease.toLowerCase().includes("healthy") ? "✅" : "⚠️"}
                    </div>
                    <div>
                      <p className="font-bold text-lg leading-tight">{parsed.disease}</p>
                      <p className="text-sm text-muted-foreground">
                        Best Confidence: {pct(prediction.confidence)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                    <Leaf className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Crop:</span>
                    <span className="font-semibold">{parsed.crop}</span>
                  </div>
                </div>

                {/* Per-Image Breakdown */}
                {allPredictions.length > 0 && (
                  <div className="p-4 bg-muted/5 border-b border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Image Breakdown
                    </p>
                    <div className="space-y-2">
                      {allPredictions.map((sub: any, i: number) => {
                        if (!sub.is_leaf) {
                          return (
                            <div
                              key={i}
                              className="text-xs flex items-center justify-between text-destructive"
                            >
                              <span>Image {i + 1}: Not a leaf</span>
                              <AlertTriangle className="h-3 w-3" />
                            </div>
                          );
                        }
                        const p = parsePrediction(sub.prediction);
                        return (
                          <div key={i} className="text-xs flex items-center justify-between">
                            <span>
                              Image {i + 1}: {p.crop} — {p.disease}
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {pct(sub.confidence)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top 5 Global */}
                {top5.length > 0 && (
                  <div className="p-5 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Top Global Predictions
                    </p>
                    {top5.map((t: any, i: number) => {
                      const { crop: c, disease: d } = parsePrediction(t.label);
                      return (
                        <div key={t.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className={i === 0 ? "font-semibold" : "text-muted-foreground"}>
                              {c} — {d}
                            </span>
                            <span
                              className={`font-mono text-xs ${i === 0 ? "font-bold text-primary" : "text-muted-foreground"
                                }`}
                            >
                              {pct(t.score)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${i === 0 ? "bg-primary" : "bg-primary/40"
                                }`}
                              style={{ width: `${pctNum(t.score)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : notLeaf ? null : (
              <Card className="border-border/50 border-dashed">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Sparkles className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium">No results yet</p>
                  <p className="text-sm mt-1">Upload images and run prediction to see analysis.</p>
                </CardContent>
              </Card>
            )}

            {/* AI Advice */}
            {prediction && (
              <Card className="border-border/50 overflow-hidden animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">AI Expert Advice</h3>
                  </div>

                  {!adviceReady && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={doAdvice}
                      disabled={adviceLoading}
                    >
                      {adviceLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {adviceLoading ? "Generating…" : "Get Advice"}
                    </Button>
                  )}

                  {adviceReady && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                    </span>
                  )}
                </div>

                <CardContent className="p-4">
                  {adviceOpen ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 max-h-64 overflow-y-auto">
                      {formatAdvice(advice)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Click "Get Advice" for AI-powered treatment recommendations
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Forward Action */}
            {permissionToForward && (
              <Card className="border-primary/30 bg-primary/5 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Ready to Forward</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Send this report (including all images) to a government agricultural officer.
                  </p>
                  <Button className="w-full gap-2 h-11" onClick={openForwardDialog}>
                    <Send className="h-4 w-4" />
                    Forward to Govt Officer
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Crop Dialog ═══ */}
      <Dialog
        open={cropIndex !== null}
        onOpenChange={(open) => {
          if (!open) setCropIndex(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5 text-primary" />
              Crop Image
            </DialogTitle>
            <DialogDescription>
              Adjust the crop area and click Apply to replace the original.
            </DialogDescription>
          </DialogHeader>

          {cropIndex !== null && previewUrls[cropIndex] && (
            <div className="w-full max-h-[60vh] overflow-hidden rounded-lg border border-border/50">
              <Cropper
                ref={cropperRef}
                src={previewUrls[cropIndex]}
                style={{ height: "100%", width: "100%", maxHeight: "55vh" }}
                viewMode={1}
                guides
                movable
                zoomable
                scalable
                background={false}
                responsive
                autoCropArea={0.9}
                checkOrientation={false}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCropIndex(null)}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={applyCrop}>
              <CheckCircle2 className="h-4 w-4" />
              Apply Crop
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Forward Mode Dialog with Mini Map ═══ */}
      <Dialog
        open={forwardDialogOpen}
        onOpenChange={(open) => {
          if (!busyForward) setForwardDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Forward to Govt Officer</DialogTitle>
            <DialogDescription>Choose how you'd like to forward your disease report.</DialogDescription>
          </DialogHeader>

          <OfficerMiniMap open={forwardDialogOpen} />

          {locationError ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive space-y-2">
                <p className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Location not set
                </p>
                <p>Please set your location from the Dashboard before forwarding to the nearest officer.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
                <Button
                  variant="default"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setLocationError(false);
                    doForward("POOL");
                  }}
                  disabled={busyForward}
                >
                  {forwardingMode === "POOL" && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Users className="h-4 w-4" /> Forward to Pool
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 py-2">
              <Button
                className="w-full h-14 gap-3 text-left justify-start"
                onClick={() => doForward("NEAREST")}
                disabled={busyForward}
              >
                {forwardingMode === "NEAREST" ? (
                  <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                ) : (
                  <MapPin className="h-5 w-5 shrink-0" />
                )}
                <div>
                  <div className="font-semibold">Forward to Nearest Officer</div>
                  <div className="text-xs font-normal opacity-80">Based on your current location</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-14 gap-3 text-left justify-start"
                onClick={() => doForward("POOL")}
                disabled={busyForward}
              >
                {forwardingMode === "POOL" ? (
                  <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                ) : (
                  <Users className="h-5 w-5 shrink-0" />
                )}
                <div>
                  <div className="font-semibold">Forward to Pool</div>
                  <div className="text-xs font-normal opacity-80">Any available officer can pick it up</div>
                </div>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
