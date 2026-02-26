package com.projectx.analytics.analytics.dto;

public record TopBrandMetricResponse(
    int brandId,
    String brandName,
    long views,
    long addToCart,
    long purchases,
    long brandClicks,
    double weightedScore
) {
}
