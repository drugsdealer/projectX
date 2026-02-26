package com.projectx.analytics.analytics.dto;

import java.time.Instant;
import java.util.List;

public record PersonalizedRecommendationResponse(
    Instant generatedAt,
    List<RecommendationProductResponse> items,
    List<TopBrandMetricResponse> topBrands
) {
}
