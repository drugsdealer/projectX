package com.projectx.analytics.event.model;

import java.time.Instant;
import java.util.UUID;

public record NormalizedEvent(
    UUID id,
    String eventType,
    Long userId,
    String sessionId,
    Integer productId,
    Long orderId,
    String pageUrl,
    String source,
    String deviceType,
    Instant occurredAt,
    String metadataJson
) {
}
