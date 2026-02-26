package com.projectx.analytics.analytics.dto;

public record RecommendationProductResponse(
    int productId,
    double score,
    String reason
) {
}
