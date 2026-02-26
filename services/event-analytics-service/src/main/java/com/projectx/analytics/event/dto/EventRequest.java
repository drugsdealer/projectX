package com.projectx.analytics.event.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record EventRequest(
    UUID eventId,
    @NotBlank @Size(max = 64) String eventType,
    Long userId,
    @NotBlank @Size(max = 200) String sessionId,
    Integer productId,
    Long orderId,
    @Size(max = 1_024) String pageUrl,
    @Size(max = 120) String source,
    @Size(max = 64) String deviceType,
    Instant occurredAt,
    Map<String, Object> metadata
) {
}
