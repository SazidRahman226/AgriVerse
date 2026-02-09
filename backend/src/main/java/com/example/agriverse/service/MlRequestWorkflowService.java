package com.example.agriverse.service;

import com.example.agriverse.dto.UserRequestResponse;
import com.example.agriverse.dto.ml.MlPredictionResponse;
import com.example.agriverse.dto.ml.PredictAndCreateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MlRequestWorkflowService {

        private final MlPredictionService mlPredictionService;
        private final AiAdviceService aiAdviceService;
        private final UserRequestService userRequestService;

        public PredictAndCreateResponse predictAndCreate(
                        List<MultipartFile> images,
                        String state,
                        String district) {
                // Run ML prediction on each image
                List<MlPredictionResponse> allPredictions = mlPredictionService.predictAll(images);

                // Find the best prediction: is_leaf == true, highest confidence
                MlPredictionResponse bestPred = allPredictions.stream()
                                .filter(p -> p.error == null && p.is_leaf != null && p.is_leaf)
                                .max(Comparator.comparingDouble(p -> p.confidence != null ? p.confidence : -1.0))
                                .orElse(null);

                // No valid leaf prediction — return all results but don't create request
                if (bestPred == null) {
                        // Pick the first non-error response to show the user, or the first overall
                        MlPredictionResponse displayPred = allPredictions.stream()
                                        .filter(p -> p.error == null)
                                        .findFirst()
                                        .orElse(allPredictions.isEmpty() ? null : allPredictions.get(0));

                        return PredictAndCreateResponse.builder()
                                        .prediction(displayPred)
                                        .allPredictions(allPredictions)
                                        .advice(null)
                                        .request(null)
                                        .requestTopic(null)
                                        .build();
                }

                // Leaf detected — extract crop and disease from "cropname___diseasename"
                String crop = bestPred.getCropName() != null ? bestPred.getCropName() : "Unknown";
                String disease = bestPred.getDiseaseName() != null ? bestPred.getDiseaseName() : "Unknown";
                String topic = crop + " • " + disease;

                // Top 3 from top5 list
                List<MlPredictionResponse.Top5> top5 = (bestPred.top5 != null) ? bestPred.top5 : List.of();
                String top3 = top5.stream()
                                .limit(3)
                                .map(t -> "- " + t.label
                                                + (t.prob != null ? String.format(" (%.2f%%)", t.prob * 100.0) : ""))
                                .collect(Collectors.joining("\n"));

                // AI advice (best effort)
                String advice = aiAdviceService.getAdvice(crop, disease);

                // Build description
                int totalImages = images != null ? images.size() : 0;
                long leafCount = allPredictions.stream()
                                .filter(p -> p.error == null && p.is_leaf != null && p.is_leaf)
                                .count();
                long rejectedCount = totalImages - leafCount;

                StringBuilder desc = new StringBuilder();
                desc.append("Crop: ").append(crop).append("\n");
                desc.append("Disease: ").append(disease).append("\n");
                if (bestPred.confidence != null) {
                        desc.append("Confidence: ").append(String.format("%.2f%%", bestPred.confidence * 100.0))
                                        .append("\n");
                }
                if (totalImages > 1) {
                        desc.append("Images: ").append(totalImages)
                                        .append(" submitted, ").append(leafCount).append(" leaf detected")
                                        .append(rejectedCount > 0 ? ", " + rejectedCount + " rejected" : "")
                                        .append("\n");
                }
                desc.append("\nTop 3 guesses:\n")
                                .append(top3.isBlank() ? "- (no probabilities provided)" : top3)
                                .append("\n\n");
                desc.append("AI advice:\n").append(advice != null ? advice : "(AI advice not available)");

                // Create request with ALL images (saves images + OPEN status + first message)
                UserRequestResponse created = userRequestService.createRequestWithPhoto(
                                topic,
                                desc.toString(),
                                state,
                                district,
                                images);

                return PredictAndCreateResponse.builder()
                                .prediction(bestPred)
                                .allPredictions(allPredictions)
                                .advice(advice)
                                .requestTopic(topic)
                                .request(created)
                                .build();
        }
}
