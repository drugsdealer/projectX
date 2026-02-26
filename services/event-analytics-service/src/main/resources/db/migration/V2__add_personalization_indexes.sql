CREATE INDEX IF NOT EXISTS idx_analytics_events_raw_user_occurred
  ON analytics_events_raw (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_raw_event_session_occurred
  ON analytics_events_raw (event_type, session_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_raw_metadata_brand_id
  ON analytics_events_raw ((metadata->>'brandId'));
