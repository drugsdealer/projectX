package com.projectx.analytics.aggregation.model;

import java.time.Instant;

public record AggregatedBucket(
    Instant bucketStart,
    String eventType,
    int productKey,
    long totalEvents,
    long uniqueSessions,
    long uniqueUsers
) {
}
