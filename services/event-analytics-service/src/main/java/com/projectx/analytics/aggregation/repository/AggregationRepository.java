package com.projectx.analytics.aggregation.repository;

import com.projectx.analytics.aggregation.model.AggregatedBucket;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AggregationRepository {

  private static final String LOCK_STATE_SQL =
      "SELECT last_processed_at FROM analytics_aggregation_state WHERE id = 1 FOR UPDATE";
  private static final String UPDATE_STATE_SQL =
      "UPDATE analytics_aggregation_state SET last_processed_at = ? WHERE id = 1";

  private static final String AGGREGATE_RANGE_SQL = """
      SELECT
        date_trunc('hour', occurred_at) AS bucket_start,
        event_type,
        COALESCE(product_id, 0) AS product_key,
        COUNT(*) AS total_events,
        COUNT(DISTINCT session_id) AS unique_sessions,
        COUNT(DISTINCT user_id) AS unique_users
      FROM analytics_events_raw
      WHERE occurred_at >= ? AND occurred_at < ?
      GROUP BY 1, 2, 3
      """;

  private static final String DELETE_RANGE_SQL = """
      DELETE FROM analytics_event_metrics_hourly
      WHERE bucket_start >= date_trunc('hour', ?::timestamptz)
        AND bucket_start < date_trunc('hour', ?::timestamptz) + interval '1 hour'
      """;

  private static final String INSERT_METRICS_SQL = """
      INSERT INTO analytics_event_metrics_hourly (
        bucket_start,
        event_type,
        product_key,
        total_events,
        unique_sessions,
        unique_users,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, now())
      ON CONFLICT (bucket_start, event_type, product_key)
      DO UPDATE SET
        total_events = EXCLUDED.total_events,
        unique_sessions = EXCLUDED.unique_sessions,
        unique_users = EXCLUDED.unique_users,
        updated_at = now()
      """;

  private final JdbcTemplate jdbcTemplate;

  public AggregationRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public Instant lockAndGetLastProcessedAt() {
    return jdbcTemplate.queryForObject(
        LOCK_STATE_SQL,
        (rs, rowNum) -> rs.getTimestamp("last_processed_at").toInstant()
    );
  }

  public void updateLastProcessedAt(Instant processedAt) {
    jdbcTemplate.update(UPDATE_STATE_SQL, Timestamp.from(processedAt));
  }

  public List<AggregatedBucket> aggregateRange(Instant from, Instant to) {
    return jdbcTemplate.query(
        AGGREGATE_RANGE_SQL,
        (rs, rowNum) -> new AggregatedBucket(
            rs.getTimestamp("bucket_start").toInstant(),
            rs.getString("event_type"),
            rs.getInt("product_key"),
            rs.getLong("total_events"),
            rs.getLong("unique_sessions"),
            rs.getLong("unique_users")
        ),
        Timestamp.from(from),
        Timestamp.from(to)
    );
  }

  public void deleteMetricsRange(Instant from, Instant to) {
    jdbcTemplate.update(
        DELETE_RANGE_SQL,
        Timestamp.from(from),
        Timestamp.from(to)
    );
  }

  public void upsertMetrics(List<AggregatedBucket> rows) {
    if (rows.isEmpty()) {
      return;
    }
    jdbcTemplate.batchUpdate(INSERT_METRICS_SQL, new BatchPreparedStatementSetter() {
      @Override
      public void setValues(PreparedStatement ps, int i) throws java.sql.SQLException {
        AggregatedBucket row = rows.get(i);
        ps.setTimestamp(1, Timestamp.from(row.bucketStart()));
        ps.setString(2, row.eventType());
        ps.setInt(3, row.productKey());
        ps.setLong(4, row.totalEvents());
        ps.setLong(5, row.uniqueSessions());
        ps.setLong(6, row.uniqueUsers());
      }

      @Override
      public int getBatchSize() {
        return rows.size();
      }
    });
  }
}
