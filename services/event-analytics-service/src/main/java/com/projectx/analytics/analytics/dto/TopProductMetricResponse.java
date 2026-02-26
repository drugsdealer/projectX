package com.projectx.analytics.analytics.dto;

public record TopProductMetricResponse(
    int productId,
    long views,
    long addToCart,
    long purchases,
    double viewToCartConversion,
    double cartToPurchaseConversion
) {
}
