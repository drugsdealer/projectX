CREATE TABLE IF NOT EXISTS analytics_events_raw (
  id UUID PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  user_id BIGINT NULL,
  session_id VARCHAR(200) NOT NULL,
  product_id INTEGER NULL,
  order_id BIGINT NULL,
  page_url VARCHAR(1024) NULL,
  source VARCHAR(120) NULL,
  device_type VARCHAR(64) NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_raw_occurred_at
  ON analytics_events_raw (occurred_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_raw_event_type_occurred
  ON analytics_events_raw (event_type, occurred_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_raw_product_occurred
  ON analytics_events_raw (product_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_raw_session_occurred
  ON analytics_events_raw (session_id, occurred_at);

CREATE TABLE IF NOT EXISTS analytics_event_metrics_hourly (
  bucket_start TIMESTAMPTZ NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  product_key INTEGER NOT NULL DEFAULT 0,
  total_events BIGINT NOT NULL,
  unique_sessions BIGINT NOT NULL,
  unique_users BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_start, event_type, product_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_metrics_hourly_event_time
  ON analytics_event_metrics_hourly (event_type, bucket_start);

CREATE INDEX IF NOT EXISTS idx_analytics_event_metrics_hourly_product_time
  ON analytics_event_metrics_hourly (product_key, bucket_start);

CREATE TABLE IF NOT EXISTS analytics_aggregation_state (
  id SMALLINT PRIMARY KEY,
  last_processed_at TIMESTAMPTZ NOT NULL
);

INSERT INTO analytics_aggregation_state (id, last_processed_at)
VALUES (1, now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;
