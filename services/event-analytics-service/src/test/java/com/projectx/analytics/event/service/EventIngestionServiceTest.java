package com.projectx.analytics.event.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.projectx.analytics.event.dto.EventRequest;
import com.projectx.analytics.event.model.NormalizedEvent;
import com.projectx.analytics.event.repository.EventWriteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@DisplayName("EventIngestionService — Unit Tests")
class EventIngestionServiceTest {

    private EventWriteRepository repository;
    private EventIngestionService service;

    @BeforeEach
    void setUp() {
        repository = mock(EventWriteRepository.class);
        service = new EventIngestionService(repository, new ObjectMapper());
    }

    // ========== Helpers ==========

    private EventRequest validRequest(String eventType) {
        return new EventRequest(
                null,              // eventId — auto-generated
                eventType,
                1L,                // userId
                "session-abc",     // sessionId
                42,                // productId
                null,              // orderId
                "/product/42",     // pageUrl
                "web",             // source
                "desktop",         // deviceType
                Instant.parse("2025-06-01T12:00:00Z"),
                Map.of("color", "red")
        );
    }

    // ========== ingestSingle ==========

    @Nested
    @DisplayName("ingestSingle")
    class IngestSingle {

        @Test
        @DisplayName("should normalize and save a valid PRODUCT_VIEW event")
        void normalizeAndSaveProductView() {
            when(repository.insertEvents(anyList())).thenReturn(1);

            int accepted = service.ingestSingle(validRequest("PRODUCT_VIEW"));

            assertThat(accepted).isEqualTo(1);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());

            List<NormalizedEvent> events = captor.getValue();
            assertThat(events).hasSize(1);

            NormalizedEvent event = events.get(0);
            assertThat(event.id()).isNotNull();
            assertThat(event.eventType()).isEqualTo("PRODUCT_VIEW");
            assertThat(event.userId()).isEqualTo(1L);
            assertThat(event.sessionId()).isEqualTo("session-abc");
            assertThat(event.productId()).isEqualTo(42);
            assertThat(event.pageUrl()).isEqualTo("/product/42");
            assertThat(event.source()).isEqualTo("web");
            assertThat(event.deviceType()).isEqualTo("desktop");
            assertThat(event.occurredAt()).isEqualTo(Instant.parse("2025-06-01T12:00:00Z"));
            assertThat(event.metadataJson()).contains("color");
        }

        @Test
        @DisplayName("should auto-generate eventId when not provided")
        void autoGenerateEventId() {
            when(repository.insertEvents(anyList())).thenReturn(1);

            service.ingestSingle(validRequest("ADD_TO_CART"));

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());

            assertThat(captor.getValue().get(0).id()).isNotNull();
        }

        @Test
        @DisplayName("should preserve provided eventId")
        void preserveEventId() {
            UUID customId = UUID.fromString("11111111-2222-3333-4444-555555555555");
            EventRequest req = new EventRequest(
                    customId, "PURCHASE", 1L, "sess-1", 10, 100L,
                    null, null, null, null, null
            );
            when(repository.insertEvents(anyList())).thenReturn(1);

            service.ingestSingle(req);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());
            assertThat(captor.getValue().get(0).id()).isEqualTo(customId);
        }

        @Test
        @DisplayName("should use Instant.now() when occurredAt is null")
        void defaultOccurredAt() {
            EventRequest req = new EventRequest(
                    null, "PRODUCT_VIEW", null, "sess-1", null, null,
                    null, null, null, null, null
            );
            when(repository.insertEvents(anyList())).thenReturn(1);
            Instant before = Instant.now();

            service.ingestSingle(req);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());

            Instant ts = captor.getValue().get(0).occurredAt();
            assertThat(ts).isAfterOrEqualTo(before);
            assertThat(ts).isBeforeOrEqualTo(Instant.now());
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "PRODUCT_VIEW", "ADD_TO_CART", "REMOVE_FROM_CART",
                "START_CHECKOUT", "PURCHASE", "SEARCH",
                "FAVORITE_ADD", "BRAND_CLICK"
        })
        @DisplayName("should accept all valid event types")
        void acceptAllValidEventTypes(String eventType) {
            when(repository.insertEvents(anyList())).thenReturn(1);

            int result = service.ingestSingle(validRequest(eventType));

            assertThat(result).isEqualTo(1);
            verify(repository).insertEvents(anyList());
        }

        @Test
        @DisplayName("should normalize eventType to uppercase")
        void uppercaseEventType() {
            when(repository.insertEvents(anyList())).thenReturn(1);

            service.ingestSingle(validRequest("product_view"));

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());
            assertThat(captor.getValue().get(0).eventType()).isEqualTo("PRODUCT_VIEW");
        }

        @ParameterizedTest
        @ValueSource(strings = {"INVALID", "PAGE_VIEW", "CLICK", "", "  "})
        @DisplayName("should reject unsupported event types")
        void rejectUnsupportedEventTypes(String eventType) {
            assertThatThrownBy(() -> service.ingestSingle(validRequest(eventType)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Unsupported eventType");

            verify(repository, never()).insertEvents(anyList());
        }

        @Test
        @DisplayName("should convert blank pageUrl to null")
        void blankPageUrlToNull() {
            EventRequest req = new EventRequest(
                    null, "PRODUCT_VIEW", 1L, "sess-1", 42, null,
                    "   ", null, null, Instant.now(), null
            );
            when(repository.insertEvents(anyList())).thenReturn(1);

            service.ingestSingle(req);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());
            assertThat(captor.getValue().get(0).pageUrl()).isNull();
        }

        @Test
        @DisplayName("should serialize null metadata as empty JSON object")
        void nullMetadataToEmptyJson() {
            EventRequest req = new EventRequest(
                    null, "PRODUCT_VIEW", 1L, "sess-1", 42, null,
                    null, null, null, Instant.now(), null
            );
            when(repository.insertEvents(anyList())).thenReturn(1);

            service.ingestSingle(req);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());
            assertThat(captor.getValue().get(0).metadataJson()).isEqualTo("{}");
        }
    }

    // ========== ingestBatch ==========

    @Nested
    @DisplayName("ingestBatch")
    class IngestBatch {

        @Test
        @DisplayName("should process multiple events in one batch")
        void batchMultipleEvents() {
            when(repository.insertEvents(anyList())).thenReturn(3);

            List<EventRequest> batch = List.of(
                    validRequest("PRODUCT_VIEW"),
                    validRequest("ADD_TO_CART"),
                    validRequest("PURCHASE")
            );

            int accepted = service.ingestBatch(batch);

            assertThat(accepted).isEqualTo(3);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<NormalizedEvent>> captor = ArgumentCaptor.forClass(List.class);
            verify(repository).insertEvents(captor.capture());
            assertThat(captor.getValue()).hasSize(3);
        }

        @Test
        @DisplayName("should handle empty batch")
        void emptyBatch() {
            when(repository.insertEvents(anyList())).thenReturn(0);

            int accepted = service.ingestBatch(List.of());

            assertThat(accepted).isEqualTo(0);
        }

        @Test
        @DisplayName("should fail entire batch if one event has invalid type")
        void failBatchOnInvalidEvent() {
            List<EventRequest> batch = List.of(
                    validRequest("PRODUCT_VIEW"),
                    validRequest("INVALID_TYPE")
            );

            assertThatThrownBy(() -> service.ingestBatch(batch))
                    .isInstanceOf(IllegalArgumentException.class);

            verify(repository, never()).insertEvents(anyList());
        }
    }
}
