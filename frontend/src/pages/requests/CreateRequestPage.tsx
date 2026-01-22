import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { requestsApi } from "@/api/requests";
import { PenLine, Upload, MapPin, FileText, Loader2, Camera, Image as ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CreateRequestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const canSubmit = category.trim().length > 0 && description.trim().length > 0 && !saving;

  function onAddFiles(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    const added = Array.from(newFiles);

    setImages((prev) => [...prev, ...added]);
    setImagePreviews((prev) => [...prev, ...added.map(f => URL.createObjectURL(f))]);
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const created = await requestsApi.create({
        category: category.trim(),
        description: description.trim(),
        state: state.trim() || undefined,
        district: district.trim() || undefined,
        image: images, // Send array
      });
      toast({ title: "Request Submitted ✅", description: "Your request has been created successfully." });
      navigate(`/requests/${created.id}`);
    } catch (e: any) {
      toast({ title: "Submission Failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <PenLine className="h-5 w-5 text-primary" />
            </div>
            New Request
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Describe your issue and we'll connect you with an officer.</p>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-6 space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Category
              </Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Leaf disease, Pest attack, Soil issue" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail — what crop, symptoms, when it started, and what you've tried…"
                className="min-h-[140px] resize-none"
              />
              <div className="text-xs text-muted-foreground text-right">{description.length} chars</div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> State
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Dhaka" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> District
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Gazipur" />
              </div>
            </div>

            {/* Photo Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" /> Photos
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-all"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Click to upload photos</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG supported • Multiple allowed</p>
              </div>

              {/* Thumbnails */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
                  {imagePreviews.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group">
                      <img src={url} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onAddFiles(e.target.files)} />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button disabled={!canSubmit} onClick={submit} className="gap-2 min-w-[140px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                {saving ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
