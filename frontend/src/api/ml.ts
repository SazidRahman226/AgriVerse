// src/api/ml.ts
import apiClient from "@/api/client";

export type MlTopK = { label: string; score: number };

export type MlPredictionResponse = {
  /** Present when the ML service returns an error (e.g. model unavailable). */
  error?: string;

  /** Whether the image contains a leaf. */
  is_leaf?: boolean;

  /** Reason shown when is_leaf === false (e.g. "Not a plant leaf"). */
  reason?: string;

  /** Probability that the image is a leaf (0–1). */
  leaf_probability?: number;

  /** Combined label e.g. "Rice___Blast". Split on "___" to get crop & disease. */
  prediction?: string;

  /** Confidence for the top prediction (0–1). */
  confidence?: number;

  /** Top-k predictions with labels and scores. */
  topk?: MlTopK[];

  crop?: string;
  model?: string;

  /** Per-image breakdown (simplified structure to avoid deep recursion issues if needed, but here we reuse the type) */
  allPredictions?: MlPredictionResponse[];
};

export type PredictAndCreateResponse = {
  prediction?: MlPredictionResponse;

  /** Per-image breakdown if the main prediction is an aggregate */
  allPredictions?: MlPredictionResponse[];

  advice?: string | null;

  // backend returns a request object (UserRequestResponse) — null when is_leaf is false
  request?: {
    id: number;
    category?: string;
    status?: string;
    assignedOfficerUsername?: string | null;
    createdAt?: string;
    imageUrls?: string[]; // ✅ NEW
    imageUrl?: string | null; // Keep for compat
  } & Record<string, any> | null;
};

/** POST /api/ml/predict — multiple images supported */
export async function mlPredict(images: Blob[]) {
  const form = new FormData();
  images.forEach((img) => form.append("image", img, "leaf.jpg"));

  const res = await apiClient.post<MlPredictionResponse>("/api/ml/predict", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/** POST /api/ml/predict-and-create — multiple images + optional location */
export async function mlPredictAndCreateRequest(
  images: Blob[],
  state?: string,
  district?: string
) {
  const form = new FormData();
  images.forEach((img) => form.append("image", img, "leaf.jpg"));
  if (state) form.append("state", state);
  if (district) form.append("district", district);

  const res = await apiClient.post<PredictAndCreateResponse>("/api/ml/predict-and-create", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/** POST /api/ml/advice */
export async function mlAdvice(cropName: string, diseaseName: string) {
  const res = await apiClient.post<{ answer: string | null }>(
    "/api/ml/advice",
    {
      crop_name: cropName,
      disease_name: diseaseName,
    }
  );
  return res.data;
}

/** POST /api/ml/forward (Pool mode — no forwardMode or forwardMode="POOL") */
export async function mlForwardToGovtOfficer(
  crop: string,
  diseaseName: string,
  advice: string,
  images: Blob[],
  state?: string,
  district?: string
) {
  const form = new FormData();
  form.append("crop", crop);
  form.append("diseaseName", diseaseName);
  form.append("advice", advice);
  images.forEach((img) => form.append("image", img, "leaf.jpg"));
  form.append("forwardMode", "POOL");
  if (state) form.append("state", state);
  if (district) form.append("district", district);

  const res = await apiClient.post("/api/ml/forward", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data; // UserRequestResponse
}

/** POST /api/ml/forward (Nearest mode — forwardMode="NEAREST") */
export async function mlForwardToNearestOfficer(
  crop: string,
  diseaseName: string,
  advice: string,
  images: Blob[],
  state?: string,
  district?: string
) {
  const form = new FormData();
  form.append("crop", crop);
  form.append("diseaseName", diseaseName);
  form.append("advice", advice);
  images.forEach((img) => form.append("image", img, "leaf.jpg"));
  form.append("forwardMode", "NEAREST");
  if (state) form.append("state", state);
  if (district) form.append("district", district);

  const res = await apiClient.post("/api/ml/forward", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data; // UserRequestResponse
}
