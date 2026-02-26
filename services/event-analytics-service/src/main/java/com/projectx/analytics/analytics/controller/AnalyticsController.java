package com.projectx.analytics.analytics.controller;

import com.projectx.analytics.analytics.dto.FunnelReportResponse;
import com.projectx.analytics.analytics.dto.PersonalizedRecommendationResponse;
import com.projectx.analytics.analytics.dto.TopBrandMetricResponse;
import com.projectx.analytics.analytics.dto.TopProductMetricResponse;
import com.projectx.analytics.analytics.service.AnalyticsQueryService;
import com.projectx.analytics.analytics.service.RecommendationQueryService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

  private final AnalyticsQueryService analyticsQueryService;
  private final RecommendationQueryService recommendationQueryService;

  public AnalyticsController(
      AnalyticsQueryService analyticsQueryService,
      RecommendationQueryService recommendationQueryService
  ) {
    this.analyticsQueryService = analyticsQueryService;
    this.recommendationQueryService = recommendationQueryService;
  }

  @GetMapping("/funnel")
  public FunnelReportResponse getFunnel(
      @RequestParam(required = false) Instant from,
      @RequestParam(required = false) Instant to
  ) {
    Instant toSafe = to == null ? Instant.now() : to;
    Instant fromSafe = from == null ? toSafe.minus(7, ChronoUnit.DAYS) : from;

    if (!toSafe.isAfter(fromSafe)) {
      throw new IllegalArgumentException("to must be greater than from");
    }

    return analyticsQueryService.getFunnel(fromSafe, toSafe);
  }

  @GetMapping("/top-products")
  public List<TopProductMetricResponse> getTopProducts(
      @RequestParam(required = false) Instant from,
      @RequestParam(required = false) Instant to,
      @RequestParam(defaultValue = "20") int limit
  ) {
    Instant toSafe = to == null ? Instant.now() : to;
    Instant fromSafe = from == null ? toSafe.minus(7, ChronoUnit.DAYS) : from;
    int safeLimit = Math.max(1, Math.min(100, limit));

    if (!toSafe.isAfter(fromSafe)) {
      throw new IllegalArgumentException("to must be greater than from");
    }

    return analyticsQueryService.getTopProducts(fromSafe, toSafe, safeLimit);
  }

  @GetMapping("/top-brands")
  public List<TopBrandMetricResponse> getTopBrands(
      @RequestParam(required = false) Instant from,
      @RequestParam(required = false) Instant to,
      @RequestParam(defaultValue = "20") int limit
  ) {
    Instant toSafe = to == null ? Instant.now() : to;
    Instant fromSafe = from == null ? toSafe.minus(30, ChronoUnit.DAYS) : from;
    int safeLimit = Math.max(1, Math.min(100, limit));

    if (!toSafe.isAfter(fromSafe)) {
      throw new IllegalArgumentException("to must be greater than from");
    }

    return recommendationQueryService.getTopBrands(fromSafe, toSafe, safeLimit);
  }

  @GetMapping("/recommendations")
  public PersonalizedRecommendationResponse getRecommendations(
      @RequestParam(required = false) Long userId,
      @RequestParam(required = false) String sessionId,
      @RequestParam(required = false) Integer categoryId,
      @RequestParam(required = false) String excludeProductIds,
      @RequestParam(defaultValue = "20") int limit,
      @RequestParam(required = false) String seed
  ) {
    int safeLimit = Math.max(1, Math.min(100, limit));
    List<Integer> excludeIds = parseIds(excludeProductIds);
    return recommendationQueryService.getRecommendations(
        userId,
        sessionId,
        categoryId,
        excludeIds,
        safeLimit,
        seed
    );
  }

  private List<Integer> parseIds(String csv) {
    if (csv == null || csv.isBlank()) {
      return List.of();
    }
    return java.util.Arrays.stream(csv.split(","))
        .map(String::trim)
        .filter(s -> !s.isBlank())
        .map(s -> {
          try {
            return Integer.parseInt(s);
          } catch (NumberFormatException ignored) {
            return null;
          }
        })
        .filter(Objects::nonNull)
        .filter(v -> v > 0)
        .distinct()
        .toList();
  }
}
