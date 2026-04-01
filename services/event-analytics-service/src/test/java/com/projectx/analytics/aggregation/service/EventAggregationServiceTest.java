package com.projectx.analytics.aggregation.service;

import com.projectx.analytics.aggregation.model.AggregatedBucket;
import com.projectx.analytics.aggregation.repository.AggregationRepository;
import com.projectx.analytics.config.AnalyticsProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("EventAggregationService — Unit Tests")
class EventAggregationServiceTest {

    private AggregationRepository repository;
    private AnalyticsProperties properties;
    private EventAggregationService service;

    @BeforeEach
    void setUp() {
        repository = mock(AggregationRepository.class);
        properties = new AnalyticsProperties();
        properties.getAggregation().setLagSeconds(0);
        properties.getAggregation().setLookbackHours(6);
        service = new EventAggregationService(repository, properties);
    }

    @Test
    @DisplayName("should aggregate and upsert metrics within time range")
    void aggregateAndUpsert() {
        Instant lastProcessed = Instant.now().minus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);
        when(repository.lockAndGetLastProcessedAt()).thenReturn(lastProcessed);

        List<AggregatedBucket> buckets = List.of(
                new AggregatedBucket(
                        Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.HOURS),
                        "PRODUCT_VIEW", 42, 100L, 50L, 30L
                ),
                new AggregatedBucket(
                        Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.HOURS),
                        "ADD_TO_CART", 42, 20L, 15L, 10L
                )
        );
        when(repository.aggregateRange(any(), any())).thenReturn(buckets);

        service.runAggregationOnce();

        verify(repository).lockAndGetLastProcessedAt();
        verify(repository).aggregateRange(any(), any());
        verify(repository).deleteMetricsRange(any(), any());
        verify(repository).upsertMetrics(buckets);
        verify(repository).updateLastProcessedAt(any());
    }

    @Test
    @DisplayName("should skip aggregation when upperBound is not after 'from'")
    void skipWhenNothingToProcess() {
        // lastProcessedAt is in the future — nothing to process
        Instant futureTime = Instant.now().plus(1, ChronoUnit.HOURS);
        when(repository.lockAndGetLastProcessedAt()).thenReturn(futureTime);

        service.runAggregationOnce();

        verify(repository).lockAndGetLastProcessedAt();
        verify(repository, never()).aggregateRange(any(), any());
        verify(repository, never()).upsertMetrics(any());
        verify(repository, never()).updateLastProcessedAt(any());
    }

    @Test
    @DisplayName("should use lookbackStart when it's more recent than lastProcessedAt")
    void useLookbackStartWhenMoreRecent() {
        // lastProcessedAt very old — should use lookbackStart
        Instant veryOld = Instant.parse("2020-01-01T00:00:00Z");
        when(repository.lockAndGetLastProcessedAt()).thenReturn(veryOld);
        when(repository.aggregateRange(any(), any())).thenReturn(List.of());

        service.runAggregationOnce();

        verify(repository).aggregateRange(any(), any());
        verify(repository).upsertMetrics(List.of());
        verify(repository).updateLastProcessedAt(any());
    }

    @Test
    @DisplayName("should handle empty aggregation result gracefully")
    void emptyAggregation() {
        Instant lastProcessed = Instant.now().minus(1, ChronoUnit.HOURS);
        when(repository.lockAndGetLastProcessedAt()).thenReturn(lastProcessed);
        when(repository.aggregateRange(any(), any())).thenReturn(List.of());

        service.runAggregationOnce();

        verify(repository).deleteMetricsRange(any(), any());
        verify(repository).upsertMetrics(List.of());
        verify(repository).updateLastProcessedAt(any());
    }
}
