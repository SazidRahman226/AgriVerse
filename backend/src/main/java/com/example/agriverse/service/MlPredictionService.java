package com.example.agriverse.service;

import com.example.agriverse.dto.ml.MlPredictionResponse;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@Service
public class MlPredictionService {

    private final WebClient mlWebClient;

    public MlPredictionService(WebClient mlWebClient) {
        this.mlWebClient = mlWebClient;
    }

    /**
     * Sends only the image to the Python ML service /predict endpoint.
     * Handles HTTP 400 (validation), 500 (internal), and connectivity errors.
     */
    public MlPredictionResponse predict(MultipartFile image) {
        try {
            MultipartBodyBuilder builder = new MultipartBodyBuilder();

            byte[] bytes = image.getBytes();
            builder.part("image", new ByteArrayResource(bytes) {
                @Override
                public String getFilename() {
                    return (image.getOriginalFilename() != null)
                            ? image.getOriginalFilename()
                            : "leaf.jpg";
                }
            })
                    .contentType(MediaType.parseMediaType(
                            image.getContentType() != null
                                    ? image.getContentType()
                                    : MediaType.IMAGE_JPEG_VALUE));

            return mlWebClient.post()
                    .uri("/predict")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .bodyValue(builder.build())
                    .retrieve()
                    .bodyToMono(MlPredictionResponse.class)
                    .onErrorResume(WebClientResponseException.class, ex -> {
                        // HTTP 400 or 500 from the ML service
                        MlPredictionResponse r = new MlPredictionResponse();
                        r.error = "ML service error (" + ex.getStatusCode().value() + "): "
                                + ex.getResponseBodyAsString();
                        return Mono.just(r);
                    })
                    .onErrorResume(ex -> {
                        // Connectivity / other errors
                        MlPredictionResponse r = new MlPredictionResponse();
                        r.error = "ML service unavailable: " + ex.getMessage();
                        return Mono.just(r);
                    })
                    .block();
        } catch (Exception e) {
            MlPredictionResponse r = new MlPredictionResponse();
            r.error = e.getMessage();
            return r;
        }
    }

    /**
     * Run predict() on each image, collecting all results.
     * Partial failures are captured in individual response objects (error field
     * set).
     */
    public java.util.List<MlPredictionResponse> predictAll(
            java.util.List<org.springframework.web.multipart.MultipartFile> images) {
        java.util.List<MlPredictionResponse> results = new java.util.ArrayList<>();
        if (images == null || images.isEmpty())
            return results;
        for (MultipartFile img : images) {
            results.add(predict(img));
        }
        return results;
    }
}
