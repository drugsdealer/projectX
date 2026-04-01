package com.projectx.analytics.analytics.controller;

import com.projectx.analytics.analytics.dto.*;
import com.projectx.analytics.analytics.service.AnalyticsQueryService;
import com.projectx.analytics.analytics.service.RecommendationQueryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AnalyticsController.class)
@DisplayName("AnalyticsController — Integration Tests")
class AnalyticsControllerTest {

    private static final String API_KEY = "test-api-key";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AnalyticsQueryService analyticsQueryService;

    @MockitoBean
    private RecommendationQueryService recommendationQueryService;

    // ========== GET /api/v1/analytics/funnel ==========

    @Nested
    @DisplayName("GET /api/v1/analytics/funnel")
    class Funnel {

        @Test
        @DisplayName("should return funnel report with default dates")
        void funnelDefaultDates() throws Exception {
            Instant now = Instant.now();
            FunnelReportResponse response = new FunnelReportResponse(
                    now.minusSeconds(7 * 86400), now, 0.05,
                    List.of(
                            new FunnelStepResponse("PRODUCT_VIEW", 1000L, null),
                            new FunnelStepResponse("ADD_TO_CART", 300L, 0.3),
                            new FunnelStepResponse("START_CHECKOUT", 100L, 0.333),
                            new FunnelStepResponse("PURCHASE", 50L, 0.5)
                    )
            );

            when(analyticsQueryService.getFunnel(any(), any())).thenReturn(response);

            mockMvc.perform(get("/api/v1/analytics/funnel")
                            .header("X-Events-Api-Key", API_KEY))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.overallConversion").value(0.05))
                    .andExpect(jsonPath("$.steps").isArray())
                    .andExpect(jsonPath("$.steps.length()").value(4))
                    .andExpect(jsonPath("$.steps[0].eventType").value("PRODUCT_VIEW"))
                    .andExpect(jsonPath("$.steps[0].events").value(1000))
                    .andExpect(jsonPath("$.steps[3].eventType").value("PURCHASE"))
                    .andExpect(jsonPath("$.steps[3].events").value(50));
        }

        @Test
        @DisplayName("should return 400 when 'to' is not after 'from'")
        void invalidDateRange() throws Exception {
            when(analyticsQueryService.getFunnel(any(), any()))
                    .thenThrow(new IllegalArgumentException("to must be greater than from"));

            mockMvc.perform(get("/api/v1/analytics/funnel")
                            .header("X-Events-Api-Key", API_KEY)
                            .param("from", "2025-06-08T00:00:00Z")
                            .param("to", "2025-06-01T00:00:00Z"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("to must be greater than from"));
        }

        @Test
        @DisplayName("should require API key")
        void requireApiKey() throws Exception {
            mockMvc.perform(get("/api/v1/analytics/funnel"))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ========== GET /api/v1/analytics/top-products ==========

    @Nested
    @DisplayName("GET /api/v1/analytics/top-products")
    class TopProducts {

        @Test
        @DisplayName("should return top products list")
        void topProducts() throws Exception {
            when(analyticsQueryService.getTopProducts(any(), any(), anyInt()))
                    .thenReturn(List.of(
                            new TopProductMetricResponse(42, 500L, 100L, 30L, 0.2, 0.3),
                            new TopProductMetricResponse(99, 200L, 50L, 10L, 0.25, 0.2)
                    ));

            mockMvc.perform(get("/api/v1/analytics/top-products")
                            .header("X-Events-Api-Key", API_KEY)
                            .param("limit", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].productId").value(42))
                    .andExpect(jsonPath("$[0].views").value(500))
                    .andExpect(jsonPath("$[0].purchases").value(30));
        }
    }

    // ========== GET /api/v1/analytics/top-brands ==========

    @Nested
    @DisplayName("GET /api/v1/analytics/top-brands")
    class TopBrands {

        @Test
        @DisplayName("should return top brands list")
        void topBrands() throws Exception {
            when(recommendationQueryService.getTopBrands(any(), any(), anyInt()))
                    .thenReturn(List.of(
                            new TopBrandMetricResponse(1, "Nike", 500L, 200L, 80L, 30L, 650.0)
                    ));

            mockMvc.perform(get("/api/v1/analytics/top-brands")
                            .header("X-Events-Api-Key", API_KEY))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].brandName").value("Nike"))
                    .andExpect(jsonPath("$[0].weightedScore").value(650.0));
        }
    }

    // ========== GET /api/v1/analytics/recommendations ==========

    @Nested
    @DisplayName("GET /api/v1/analytics/recommendations")
    class Recommendations {

        @Test
        @DisplayName("should return personalized recommendations")
        void personalizedRecommendations() throws Exception {
            Instant now = Instant.now();
            PersonalizedRecommendationResponse response = new PersonalizedRecommendationResponse(
                    now,
                    List.of(
                            new RecommendationProductResponse(42, 15.5, "direct_interest"),
                            new RecommendationProductResponse(99, 10.2, "brand_affinity")
                    ),
                    List.of(
                            new TopBrandMetricResponse(1, "Nike", 100L, 50L, 20L, 5L, 120.0)
                    )
            );

            when(recommendationQueryService.getRecommendations(
                    any(), any(), any(), anyList(), anyInt(), any()
            )).thenReturn(response);

            mockMvc.perform(get("/api/v1/analytics/recommendations")
                            .header("X-Events-Api-Key", API_KEY)
                            .param("userId", "1")
                            .param("sessionId", "sess-abc")
                            .param("limit", "20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.generatedAt").isNotEmpty())
                    .andExpect(jsonPath("$.items").isArray())
                    .andExpect(jsonPath("$.items.length()").value(2))
                    .andExpect(jsonPath("$.items[0].productId").value(42))
                    .andExpect(jsonPath("$.items[0].reason").value("direct_interest"))
                    .andExpect(jsonPath("$.topBrands[0].brandName").value("Nike"));
        }

        @Test
        @DisplayName("should parse excludeProductIds CSV parameter")
        void parseExcludeIds() throws Exception {
            Instant now = Instant.now();
            PersonalizedRecommendationResponse response = new PersonalizedRecommendationResponse(
                    now, List.of(), List.of()
            );

            when(recommendationQueryService.getRecommendations(
                    any(), any(), any(), anyList(), anyInt(), any()
            )).thenReturn(response);

            mockMvc.perform(get("/api/v1/analytics/recommendations")
                            .header("X-Events-Api-Key", API_KEY)
                            .param("userId", "1")
                            .param("sessionId", "s1")
                            .param("excludeProductIds", "10,20,30"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items").isArray());
        }

        @Test
        @DisplayName("should work without optional parameters")
        void minimalParams() throws Exception {
            Instant now = Instant.now();
            PersonalizedRecommendationResponse response = new PersonalizedRecommendationResponse(
                    now, List.of(), List.of()
            );

            when(recommendationQueryService.getRecommendations(
                    any(), any(), any(), anyList(), anyInt(), any()
            )).thenReturn(response);

            mockMvc.perform(get("/api/v1/analytics/recommendations")
                            .header("X-Events-Api-Key", API_KEY))
                    .andExpect(status().isOk());
        }
    }
}
