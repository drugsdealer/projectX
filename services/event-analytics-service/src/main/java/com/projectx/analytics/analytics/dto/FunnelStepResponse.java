package com.projectx.analytics.analytics.dto;

public record FunnelStepResponse(
    String eventType,
    long events,
    Double conversionFromPrevious
) {
}
