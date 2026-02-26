package com.projectx.analytics.analytics.service;

import com.projectx.analytics.analytics.dto.FunnelReportResponse;
import com.projectx.analytics.analytics.dto.FunnelStepResponse;
import com.projectx.analytics.analytics.dto.TopProductMetricResponse;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AnalyticsQueryService {

  private static final List<String> FUNNEL_STEPS = List.of(
      "PRODUCT_VIEW",
      "ADD_TO_CART",
      "START_CHECKOUT",
      "PURCHASE"
  );

  private static final String FUNNEL_SQL = """
      SELECT event_type, SUM(total_events) AS total_events
      FROM analytics_event_metrics_hourly
      WHERE bucket_start >= ?
        AND bucket_start <= ?
      GROUP BY event_type
      """;

  private static final String TOP_PRODUCTS_SQL = """
      SELECT
        product_key AS product_id,
        COALESCE(SUM(CASE WHEN event_type = 'PRODUCT_VIEW' THEN total_events END), 0) AS views,
        COALESCE(SUM(CASE WHEN event_type = 'ADD_TO_CART' THEN total_events END), 0) AS add_to_cart,
        COALESCE(SUM(CASE WHEN event_type = 'PURCHASE' THEN total_events END), 0) AS purchases
      FROM analytics_event_metrics_hourly
      WHERE product_key > 0
        AND bucket_start >= ?
        AND bucket_start <= ?
      GROUP BY product_key
      ORDER BY purchases DESC, add_to_cart DESC, views DESC
      LIMIT ?
      """;

  private final JdbcTemplate jdbcTemplate;

  public AnalyticsQueryService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public FunnelReportResponse getFunnel(Instant from, Instant to) {
    Instant fromSafe = from.truncatedTo(ChronoUnit.SECONDS);
    Instant toSafe = to.truncatedTo(ChronoUnit.SECONDS);

    List<Map<String, Object>> rows = jdbcTemplate.queryForList(
        FUNNEL_SQL,
        Timestamp.from(fromSafe),
        Timestamp.from(toSafe)
    );

    Map<String, Long> counter = new HashMap<>();
    for (Map<String, Object> row : rows) {
      String eventType = String.valueOf(row.get("event_type"));
      long value = ((Number) row.get("total_events")).longValue();
      counter.put(eventType, value);
    }

    long views = counter.getOrDefault("PRODUCT_VIEW", 0L);
    long purchases = counter.getOrDefault("PURCHASE", 0L);
    List<FunnelStepResponse> steps = new java.util.ArrayList<>();
    long previous = 0L;
    for (String step : FUNNEL_STEPS) {
      long count = counter.getOrDefault(step, 0L);
      Double conversion = previous > 0 ? (double) count / (double) previous : null;
      steps.add(new FunnelStepResponse(step, count, conversion));
      previous = count;
    }

    double overallConversion = views > 0 ? (double) purchases / (double) views : 0.0;
    return new FunnelReportResponse(fromSafe, toSafe, overallConversion, steps);
  }

  public List<TopProductMetricResponse> getTopProducts(Instant from, Instant to, int limit) {
    Instant fromSafe = from.truncatedTo(ChronoUnit.SECONDS);
    Instant toSafe = to.truncatedTo(ChronoUnit.SECONDS);

    return jdbcTemplate.query(
        TOP_PRODUCTS_SQL,
        (rs, rowNum) -> {
          long views = rs.getLong("views");
          long addToCart = rs.getLong("add_to_cart");
          long purchases = rs.getLong("purchases");
          double viewToCart = views > 0 ? (double) addToCart / (double) views : 0.0;
          double cartToPurchase = addToCart > 0 ? (double) purchases / (double) addToCart : 0.0;

          return new TopProductMetricResponse(
              rs.getInt("product_id"),
              views,
              addToCart,
              purchases,
              viewToCart,
              cartToPurchase
          );
        },
        Timestamp.from(fromSafe),
        Timestamp.from(toSafe),
        limit
    );
  }
}
