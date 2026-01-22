package com.example.agriverse.dto.ml;

import java.util.List;

public class MlPredictionResponse {

    // Leaf gate result
    public Boolean is_leaf;
    public String reason; // why it was rejected (non-leaf cases)
    public Double leaf_probability;
    public Object leaf_debug;

    // Prediction result (only present when is_leaf == true)
    public Integer prediction_index;
    public String prediction; // format: "cropname___diseasename"
    public Double confidence;
    public List<Top5> top5;

    // Metadata
    public String saved_as;

    // Error (set on 400/500 from ML, or on connectivity failure)
    public String error;

    public static class Top5 {
        public String label;
        public Double prob;
    }

    // ---------- helpers for Java consumers ----------

    /**
     * Extract the crop name from the "crop___disease" prediction string.
     */
    public String getCropName() {
        if (prediction == null || !prediction.contains("___"))
            return null;
        return prediction.split("___", 2)[0].replace("_", " ").trim();
    }

    /**
     * Extract the disease name from the "crop___disease" prediction string.
     */
    public String getDiseaseName() {
        if (prediction == null || !prediction.contains("___"))
            return prediction;
        return prediction.split("___", 2)[1].replace("_", " ").trim();
    }
}
