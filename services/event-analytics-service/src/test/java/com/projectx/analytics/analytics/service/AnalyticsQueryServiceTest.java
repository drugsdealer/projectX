package com.projectx.analytics.analytics.service;

import com.projectx.analytics.analytics.dto.FunnelReportResponse;
import com.projectx.analytics.analytics.dto.TopProductMetricResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("AnalyticsQueryService — Unit Tests")
class AnalyticsQueryServiceTest {

    private JdbcTemplate jdbcTemplate;
    private AnalyticsQueryService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        service = new AnalyticsQueryService(jdbcTemplate);
    }

    @Nested
    @DisplayName("getFunnel")
    class GetFunnel {

        @Test
        @DisplayName("should build funnel with correct conversion rates")
        void buildFunnelWithConversions() {
            Instant from = Instant.parse("2025-06-01T00:00:00Z");
            Instant to = Instant.parse("2025-06-08T00:00:00Z");

            List<Map<String, Object>> mockRows = List.of(
                    Map.of("event_type", "PRODUCT_VIEW", "total_events", 1000L),
                    Map.of("event_type", "ADD_TO_CART", "total_events", 300L),
                    Map.of("event_type", "START_CHECKOUT", "total_events", 100L),
                    Map.of("event_type", "PURCHASE", "total_events", 50L)
            );

            when(jdbcTemplate.queryForList(
                    any(String.class),
                    ArgumentMatchers.<Object>any(),
                    ArgumentMatchers.<Object>any()
            )).thenReturn(mockRows);

            FunnelReportResponse result = service.getFunnel(from, to);

            assertThat(result.from()).isEqualTo(from);
            assertThat(result.to()).isEqualTo(to);
            assertThat(result.steps()).hasSize(4);

            // PRODUCT_VIEW: 1000, previous=0 -> conversion=null
            assertThat(result.steps().get(0).eventType()).isEqualTo("PRODUCT_VIEW");
            assertThat(result.steps().get(0).events()).isEqualTo(1000L);
            assertThat(result.steps().get(0).conversionFromPrevious()).isNull();

            // ADD_TO_CART: 300/1000 = 0.3
            assertThat(result.steps().get(1).eventType()).isEqualTo("ADD_TO_CART");
            assertThat(result.steps().get(1).events()).isEqualTo(300L);
            assertThat(result.steps().get(1).conversionFromPrevious()).isCloseTo(0.3, within(0.001));

            // START_CHECKOUT: 100/300 = 0.333
            assertThat(result.steps().get(2).eventType()).isEqualTo("START_CHECKOUT");
            assertThat(result.steps().get(2).conversionFromPrevious()).isCloseTo(0.333, within(0.001));

            // PURCHASE: 50/100 = 0.5
            assertThat(result.steps().get(3).eventType()).isEqualTo("PURCHASE");
            assertThat(result.steps().get(3).conversionFromPrevious()).isCloseTo(0.5, within(0.001));

            // overall: 50/1000 = 0.05
            assertThat(result.overallConversion()).isCloseTo(0.05, within(0.001));
        }

        @Test
        @DisplayName("should handle empty data gracefully")
        void emptyFunnel() {
            Instant from = Instant.parse("2025-06-01T00:00:00Z");
            Instant to = Instant.parse("2025-06-08T00:00:00Z");

            when(jdbcTemplate.queryForList(
                    any(String.class),
                    ArgumentMatchers.<Object>any(),
                    ArgumentMatchers.<Object>any()
            )).thenReturn(List.of());

            FunnelReportResponse result = service.getFunnel(from, to);

            assertThat(result.steps()).hasSize(4);
            assertThat(result.overallConversion()).isEqualTo(0.0);
            result.steps().forEach(step -> assertThat(step.events()).isZero());
        }

        @Test
        @DisplayName("should handle zero views (no division by zero)")
        void zeroViewsFunnel() {
            Instant from = Instant.now().minus(7, ChronoUnit.DAYS);
            Instant to = Instant.now();

            when(jdbcTemplate.queryForList(
                    any(String.class),
                    ArgumentMatchers.<Object>any(),
                    ArgumentMatchers.<Object>any()
            )).thenReturn(List.of(
                    Map.of("event_type", "ADD_TO_CART", "total_events", 5L)
            ));

            FunnelReportResponse result = service.getFunnel(from, to);

            assertThat(result.overallConversion()).isEqualTo(0.0);
            // ADD_TO_CART step: previous (PRODUCT_VIEW) = 0, so conversion = null
            assertThat(result.steps().get(1).conversionFromPrevious()).isNull();
        }
    }

    @Nested
    @DisplayName("getTopProducts")
    class GetTopProducts {

        @Test
        @DisplayName("should return top products with computed metrics")
        void returnTopProducts() {
            Instant from = Instant.parse("2025-06-01T00:00:00Z");
            Instant to = Instant.parse("2025-06-08T00:00:00Z");

            TopProductMetricResponse product1 = new TopProductMetricResponse(
                    42, 500L, 100L, 30L, 0.2, 0.3
            );
            TopProductMetricResponse product2 = new TopProductMetricResponse(
                    99, 200L, 50L, 10L, 0.25, 0.2
            );

            when(jdbcTemplate.query(
                    any(String.class),
                    ArgumentMatchers.<RowMapper<TopProductMetricResponse>>any(),
                    any(), any(), any()
            )).thenReturn(List.of(product1, product2));

            List<TopProductMetricResponse> result = service.getTopProducts(from, to, 20);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).productId()).isEqualTo(42);
            assertThat(result.get(0).views()).isEqualTo(500L);
            assertThat(result.get(0).purchases()).isEqualTo(30L);
        }

        @Test
        @DisplayName("should return empty list when no data")
        void emptyTopProducts() {
            when(jdbcTemplate.query(
                    any(String.class),
                    ArgumentMatchers.<RowMapper<TopProductMetricResponse>>any(),
                    any(), any(), any()
            )).thenReturn(List.of());

            List<TopProductMetricResponse> result = service.getTopProducts(
                    Instant.now().minus(7, ChronoUnit.DAYS),
                    Instant.now(),
                    20
            );

            assertThat(result).isEmpty();
        }
    }
}
