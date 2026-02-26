package com.projectx.analytics.event.repository;

import com.projectx.analytics.event.model.NormalizedEvent;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EventWriteRepository {

  private static final String INSERT_SQL = """
      INSERT INTO analytics_events_raw (
        id,
        event_type,
        user_id,
        session_id,
        product_id,
        order_id,
        page_url,
        source,
        device_type,
        occurred_at,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), now())
      ON CONFLICT (id) DO NOTHING
      """;

  private final JdbcTemplate jdbcTemplate;

  public EventWriteRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public int insertEvents(List<NormalizedEvent> events) {
    if (events.isEmpty()) {
      return 0;
    }

    int[] updated = jdbcTemplate.batchUpdate(INSERT_SQL, new BatchPreparedStatementSetter() {
      @Override
      public void setValues(PreparedStatement ps, int i) throws java.sql.SQLException {
        NormalizedEvent event = events.get(i);
        ps.setObject(1, event.id());
        ps.setString(2, event.eventType());
        ps.setObject(3, event.userId());
        ps.setString(4, event.sessionId());
        ps.setObject(5, event.productId());
        ps.setObject(6, event.orderId());
        ps.setString(7, event.pageUrl());
        ps.setString(8, event.source());
        ps.setString(9, event.deviceType());
        ps.setTimestamp(10, Timestamp.from(event.occurredAt()));
        ps.setString(11, event.metadataJson());
      }

      @Override
      public int getBatchSize() {
        return events.size();
      }
    });

    int accepted = 0;
    for (int one : updated) {
      if (one > 0) {
        accepted++;
      }
    }
    return accepted;
  }
}
