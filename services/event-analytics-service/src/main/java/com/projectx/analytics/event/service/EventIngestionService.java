package com.projectx.analytics.event.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.projectx.analytics.event.dto.EventRequest;
import com.projectx.analytics.event.model.NormalizedEvent;
import com.projectx.analytics.event.repository.EventWriteRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class EventIngestionService {

  private static final Set<String> ALLOWED_EVENT_TYPES = Set.of(
      "PRODUCT_VIEW",
      "ADD_TO_CART",
      "REMOVE_FROM_CART",
      "START_CHECKOUT",
      "PURCHASE",
      "SEARCH",
      "FAVORITE_ADD",
      "BRAND_CLICK"
  );

  private final EventWriteRepository eventWriteRepository;
  private final ObjectMapper objectMapper;

  public EventIngestionService(EventWriteRepository eventWriteRepository, ObjectMapper objectMapper) {
    this.eventWriteRepository = eventWriteRepository;
    this.objectMapper = objectMapper;
  }

  public int ingestSingle(EventRequest request) {
    NormalizedEvent event = normalize(request);
    return eventWriteRepository.insertEvents(List.of(event));
  }

  public int ingestBatch(List<EventRequest> events) {
    List<NormalizedEvent> prepared = events.stream().map(this::normalize).toList();
    return eventWriteRepository.insertEvents(prepared);
  }

  private NormalizedEvent normalize(EventRequest request) {
    String eventType = request.eventType().trim().toUpperCase(Locale.ROOT);
    if (!ALLOWED_EVENT_TYPES.contains(eventType)) {
      throw new IllegalArgumentException("Unsupported eventType: " + request.eventType());
    }

    Instant occurredAt = request.occurredAt() == null ? Instant.now() : request.occurredAt();
    UUID id = request.eventId() == null ? UUID.randomUUID() : request.eventId();

    String metadataJson = toJson(
        request.metadata() == null ? Map.of() : request.metadata()
    );

    return new NormalizedEvent(
        id,
        eventType,
        request.userId(),
        request.sessionId().trim(),
        request.productId(),
        request.orderId(),
        blankToNull(request.pageUrl()),
        blankToNull(request.source()),
        blankToNull(request.deviceType()),
        occurredAt,
        metadataJson
    );
  }

  private String blankToNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  private String toJson(Map<String, Object> map) {
    try {
      return objectMapper.writeValueAsString(map);
    } catch (JsonProcessingException ex) {
      throw new IllegalArgumentException("metadata must be valid JSON object", ex);
    }
  }
}
