package com.example.agriverse.controller;

import com.example.agriverse.dto.ml.MlPredictionResponse;
import com.example.agriverse.service.MlPredictionService;
import com.example.agriverse.service.UserRequestService;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import com.example.agriverse.dto.ml.PredictAndCreateResponse;
import com.example.agriverse.service.MlRequestWorkflowService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.agriverse.service.AiAdviceService;
import com.example.agriverse.dto.UserRequestResponse;

@RestController
@RequestMapping("/api/ml")
@RequiredArgsConstructor
public class MlWorkflowController {
    private final UserRequestService userRequestService;
    private final MlRequestWorkflowService workflow;
    private final MlPredictionService mlPredictionService;
    private final AiAdviceService aiAdviceService;

    /**
     * POST /api/ml/predict
     * Sends image(s) to Python ML service and returns prediction results.
     * Returns: best prediction + all per-image predictions.
     */
    @PostMapping(value = "/predict", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PredictAndCreateResponse predict(
            @RequestPart("image") List<MultipartFile> images) {
        List<MlPredictionResponse> allPredictions = mlPredictionService.predictAll(images);

        // Best prediction: is_leaf == true, highest confidence
        MlPredictionResponse best = allPredictions.stream()
                .filter(p -> p.error == null && p.is_leaf != null && p.is_leaf)
                .max(Comparator.comparingDouble(p -> p.confidence != null ? p.confidence : -1.0))
                .orElse(null);

        // If no leaf prediction, show first non-error result
        if (best == null) {
            best = allPredictions.stream()
                    .filter(p -> p.error == null)
                    .findFirst()
                    .orElse(allPredictions.isEmpty() ? null : allPredictions.get(0));
        }

        return PredictAndCreateResponse.builder()
                .prediction(best)
                .allPredictions(allPredictions)
                .advice(null)
                .request(null)
                .requestTopic(null)
                .build();
    }

    /**
     * POST /api/ml/predict-and-create
     * Predicts disease from image(s), then (if leaf detected) creates a
     * UserRequest.
     * Crop is extracted from the prediction "crop___disease" format.
     */
    @PostMapping(value = "/predict-and-create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PredictAndCreateResponse predictAndCreate(
            @RequestPart("image") List<MultipartFile> images,
            @RequestPart(value = "state", required = false) String state,
            @RequestPart(value = "district", required = false) String district) {
        return workflow.predictAndCreate(images, state, district);
    }

    @PostMapping("/advice")
    public Map<String, Object> advice(@RequestBody Map<String, String> body) {
        String cropName = body.get("crop_name");
        String diseaseName = body.get("disease_name");

        String answer = aiAdviceService.getAdvice(cropName, diseaseName);
        return Map.of("answer", answer);
    }

    /**
     * POST /api/ml/forward
     * Forward a disease detection result to a Govt Officer.
     * forwardMode: "POOL" (default) or "NEAREST" (nearest officer by location)
     */
    @PostMapping(value = "/forward", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserRequestResponse forwardToGovtOfficer(
            @RequestPart("crop") String crop,
            @RequestPart("diseaseName") String diseaseName,
            @RequestPart("advice") String advice,
            @RequestPart("image") List<MultipartFile> images,
            @RequestPart(value = "state", required = false) String state,
            @RequestPart(value = "district", required = false) String district,
            @RequestPart(value = "forwardMode", required = false) String forwardMode) {
        String category = crop + " • " + diseaseName;
        String description = diseaseName + "\n\n" + advice;

        if ("NEAREST".equalsIgnoreCase(forwardMode)) {
            return userRequestService.createRequestForNearestOfficer(
                    category, description, state, district, images);
        }

        // Default: pool mode (OPEN, unassigned)
        return userRequestService.createRequestWithPhoto(category, description, state, district, images);
    }
}
