package com.projectx.analytics.analytics.service;

import com.projectx.analytics.analytics.dto.PersonalizedRecommendationResponse;
import com.projectx.analytics.analytics.dto.RecommendationProductResponse;
import com.projectx.analytics.analytics.dto.TopBrandMetricResponse;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class RecommendationQueryService {

  private static final String RECOMMENDATION_SQL_TEMPLATE = """
      WITH viewer_events AS (
        SELECT
          e.event_type,
          e.product_id,
          COALESCE(
            p_evt."brandId",
            CASE
              WHEN (e.metadata->>'brandId') ~ '^[0-9]+$'
              THEN (e.metadata->>'brandId')::int
            END
          ) AS brand_id
        FROM analytics_events_raw e
        LEFT JOIN "Product" p_evt ON p_evt.id = e.product_id
        WHERE e.occurred_at >= ?
          AND (
            (? IS NOT NULL AND e.user_id = ?)
            OR (? IS NULL AND ? IS NOT NULL AND e.session_id = ?)
          )
      ),
      product_scores AS (
        SELECT
          product_id,
          SUM(
            CASE event_type
              WHEN 'PURCHASE' THEN 16.0
              WHEN 'ADD_TO_CART' THEN 7.0
              WHEN 'FAVORITE_ADD' THEN 6.0
              WHEN 'PRODUCT_VIEW' THEN 2.0
              WHEN 'SEARCH' THEN 0.8
              ELSE 0.0
            END
          ) AS score
        FROM viewer_events
        WHERE product_id IS NOT NULL
        GROUP BY product_id
      ),
      brand_scores AS (
        SELECT
          brand_id,
          SUM(
            CASE event_type
              WHEN 'PURCHASE' THEN 10.0
              WHEN 'ADD_TO_CART' THEN 6.0
              WHEN 'FAVORITE_ADD' THEN 5.0
              WHEN 'PRODUCT_VIEW' THEN 2.5
              WHEN 'BRAND_CLICK' THEN 4.0
              WHEN 'SEARCH' THEN 1.0
              ELSE 0.0
            END
          ) AS score
        FROM viewer_events
        WHERE brand_id IS NOT NULL
        GROUP BY brand_id
      ),
      global_scores AS (
        SELECT
          product_key AS product_id,
          SUM(
            CASE event_type
              WHEN 'PURCHASE' THEN total_events * 4.0
              WHEN 'ADD_TO_CART' THEN total_events * 2.0
              WHEN 'PRODUCT_VIEW' THEN total_events * 0.4
              ELSE 0.0
            END
          ) AS score
        FROM analytics_event_metrics_hourly
        WHERE product_key > 0
          AND bucket_start >= ?
        GROUP BY product_key
      ),
      candidate_scores AS (
        SELECT
          p.id AS product_id,
          COALESCE(ps.score, 0.0) AS direct_score,
          COALESCE(bs.score, 0.0) AS brand_score,
          COALESCE(gs.score, 0.0) AS global_score,
          (
            COALESCE(ps.score, 0.0) * 2.4
            + COALESCE(bs.score, 0.0) * 1.1
            + COALESCE(gs.score, 0.0) * 0.06
            + ((abs(hashtext(CAST(p.id AS text) || ?)) %% 1000) / 100000.0)
          ) AS total_score
        FROM "Product" p
        LEFT JOIN product_scores ps ON ps.product_id = p.id
        LEFT JOIN brand_scores bs ON bs.brand_id = p."brandId"
        LEFT JOIN global_scores gs ON gs.product_id = p.id
        WHERE p."deletedAt" IS NULL
          AND COALESCE(p.available, true) = true
          AND (? IS NULL OR p."categoryId" = ?)
      )
      SELECT product_id, total_score, direct_score, brand_score
      FROM candidate_scores
      WHERE total_score > 0
      %s
      ORDER BY total_score DESC
      LIMIT ?
      """;

  private static final String TOP_BRANDS_PERSONAL_SQL = """
      WITH viewer_events AS (
        SELECT
          e.event_type,
          COALESCE(
            p_evt."brandId",
            CASE
              WHEN (e.metadata->>'brandId') ~ '^[0-9]+$'
              THEN (e.metadata->>'brandId')::int
            END
          ) AS brand_id
        FROM analytics_events_raw e
        LEFT JOIN "Product" p_evt ON p_evt.id = e.product_id
        WHERE e.occurred_at >= ?
          AND (
            (? IS NOT NULL AND e.user_id = ?)
            OR (? IS NULL AND ? IS NOT NULL AND e.session_id = ?)
          )
      )
      SELECT
        b.id AS brand_id,
        b.name AS brand_name,
        COALESCE(SUM(CASE WHEN ve.event_type = 'PRODUCT_VIEW' THEN 1 ELSE 0 END), 0) AS views,
        COALESCE(SUM(CASE WHEN ve.event_type = 'ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS add_to_cart,
        COALESCE(SUM(CASE WHEN ve.event_type = 'PURCHASE' THEN 1 ELSE 0 END), 0) AS purchases,
        COALESCE(SUM(CASE WHEN ve.event_type = 'BRAND_CLICK' THEN 1 ELSE 0 END), 0) AS brand_clicks,
        (
          COALESCE(SUM(CASE WHEN ve.event_type = 'PURCHASE' THEN 1 ELSE 0 END), 0) * 4.0
          + COALESCE(SUM(CASE WHEN ve.event_type = 'ADD_TO_CART' THEN 1 ELSE 0 END), 0) * 2.0
          + COALESCE(SUM(CASE WHEN ve.event_type = 'BRAND_CLICK' THEN 1 ELSE 0 END), 0) * 1.5
          + COALESCE(SUM(CASE WHEN ve.event_type = 'PRODUCT_VIEW' THEN 1 ELSE 0 END), 0) * 0.5
        ) AS weighted_score
      FROM viewer_events ve
      JOIN "Brand" b ON b.id = ve.brand_id
      GROUP BY b.id, b.name
      ORDER BY weighted_score DESC, purchases DESC, add_to_cart DESC, views DESC
      LIMIT ?
      """;

  private static final String TOP_BRANDS_GLOBAL_SQL = """
      SELECT
        b.id AS brand_id,
        b.name AS brand_name,
        COALESCE(SUM(CASE WHEN e.event_type = 'PRODUCT_VIEW' THEN 1 ELSE 0 END), 0) AS views,
        COALESCE(SUM(CASE WHEN e.event_type = 'ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS add_to_cart,
        COALESCE(SUM(CASE WHEN e.event_type = 'PURCHASE' THEN 1 ELSE 0 END), 0) AS purchases,
        COALESCE(SUM(CASE WHEN e.event_type = 'BRAND_CLICK' THEN 1 ELSE 0 END), 0) AS brand_clicks,
        (
          COALESCE(SUM(CASE WHEN e.event_type = 'PURCHASE' THEN 1 ELSE 0 END), 0) * 4.0
          + COALESCE(SUM(CASE WHEN e.event_type = 'ADD_TO_CART' THEN 1 ELSE 0 END), 0) * 2.0
          + COALESCE(SUM(CASE WHEN e.event_type = 'BRAND_CLICK' THEN 1 ELSE 0 END), 0) * 1.5
          + COALESCE(SUM(CASE WHEN e.event_type = 'PRODUCT_VIEW' THEN 1 ELSE 0 END), 0) * 0.5
        ) AS weighted_score
      FROM analytics_events_raw e
      LEFT JOIN "Product" p_evt ON p_evt.id = e.product_id
      LEFT JOIN "Brand" b ON b.id = COALESCE(
        p_evt."brandId",
        CASE
          WHEN (e.metadata->>'brandId') ~ '^[0-9]+$'
          THEN (e.metadata->>'brandId')::int
        END
      )
      WHERE e.occurred_at >= ?
        AND e.occurred_at <= ?
        AND b.id IS NOT NULL
      GROUP BY b.id, b.name
      ORDER BY weighted_score DESC, purchases DESC, add_to_cart DESC, views DESC
      LIMIT ?
      """;

  private final JdbcTemplate jdbcTemplate;

  public RecommendationQueryService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public PersonalizedRecommendationResponse getRecommendations(
      Long userId,
      String sessionId,
      Integer categoryId,
      List<Integer> excludeProductIds,
      int limit,
      String seed
  ) {
    int safeLimit = Math.max(1, Math.min(100, limit));
    Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    Instant viewerFrom = now.minus(180, ChronoUnit.DAYS);
    Instant globalFrom = now.minus(120, ChronoUnit.DAYS);
    String tieBreakerSeed = seed == null || seed.isBlank() ? String.valueOf(now.getEpochSecond()) : seed.trim();

    List<Integer> excludes = sanitizeIds(excludeProductIds);
    String exclusionSql = "";
    if (!excludes.isEmpty()) {
      exclusionSql = " AND product_id NOT IN (" + "?,".repeat(excludes.size());
      exclusionSql = exclusionSql.substring(0, exclusionSql.length() - 1) + ")";
    }

    String sql = String.format(RECOMMENDATION_SQL_TEMPLATE, exclusionSql);

    List<Object> params = new ArrayList<>();
    params.add(Timestamp.from(viewerFrom));
    params.add(userId);
    params.add(userId);
    params.add(userId);
    params.add(sessionId);
    params.add(sessionId);
    params.add(Timestamp.from(globalFrom));
    params.add(tieBreakerSeed);
    params.add(categoryId);
    params.add(categoryId);
    params.addAll(excludes);
    params.add(safeLimit);

    List<RecommendationProductResponse> items = jdbcTemplate.query(
        sql,
        (rs, rowNum) -> new RecommendationProductResponse(
            rs.getInt("product_id"),
            rs.getDouble("total_score"),
            resolveReason(rs.getDouble("direct_score"), rs.getDouble("brand_score"))
        ),
        params.toArray()
    );

    List<TopBrandMetricResponse> topBrands = getPersonalTopBrands(userId, sessionId, 8);

    return new PersonalizedRecommendationResponse(now, items, topBrands);
  }

  public List<TopBrandMetricResponse> getTopBrands(Instant from, Instant to, int limit) {
    int safeLimit = Math.max(1, Math.min(100, limit));
    Instant fromSafe = from.truncatedTo(ChronoUnit.SECONDS);
    Instant toSafe = to.truncatedTo(ChronoUnit.SECONDS);

    return jdbcTemplate.query(
        TOP_BRANDS_GLOBAL_SQL,
        (rs, rowNum) -> new TopBrandMetricResponse(
            rs.getInt("brand_id"),
            rs.getString("brand_name"),
            rs.getLong("views"),
            rs.getLong("add_to_cart"),
            rs.getLong("purchases"),
            rs.getLong("brand_clicks"),
            rs.getDouble("weighted_score")
        ),
        Timestamp.from(fromSafe),
        Timestamp.from(toSafe),
        safeLimit
    );
  }

  private List<TopBrandMetricResponse> getPersonalTopBrands(Long userId, String sessionId, int limit) {
    int safeLimit = Math.max(1, Math.min(20, limit));
    Instant from = Instant.now().minus(180, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

    List<TopBrandMetricResponse> rows = jdbcTemplate.query(
        TOP_BRANDS_PERSONAL_SQL,
        (rs, rowNum) -> new TopBrandMetricResponse(
            rs.getInt("brand_id"),
            rs.getString("brand_name"),
            rs.getLong("views"),
            rs.getLong("add_to_cart"),
            rs.getLong("purchases"),
            rs.getLong("brand_clicks"),
            rs.getDouble("weighted_score")
        ),
        Timestamp.from(from),
        userId,
        userId,
        userId,
        sessionId,
        sessionId,
        safeLimit
    );

    return rows == null ? Collections.emptyList() : rows;
  }

  private String resolveReason(double directScore, double brandScore) {
    if (directScore > 0 && brandScore > 0) {
      return "direct_and_brand_interest";
    }
    if (directScore > 0) {
      return "direct_interest";
    }
    if (brandScore > 0) {
      return "brand_affinity";
    }
    return "global_trending";
  }

  private List<Integer> sanitizeIds(List<Integer> ids) {
    if (ids == null || ids.isEmpty()) {
      return Collections.emptyList();
    }
    return ids.stream()
        .filter(Objects::nonNull)
        .filter(v -> v > 0)
        .distinct()
        .toList();
  }
}
