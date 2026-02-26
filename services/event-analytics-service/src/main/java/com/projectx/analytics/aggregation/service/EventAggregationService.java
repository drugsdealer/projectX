package com.projectx.analytics.aggregation.service;

import com.projectx.analytics.aggregation.model.AggregatedBucket;
import com.projectx.analytics.aggregation.repository.AggregationRepository;
import com.projectx.analytics.config.AnalyticsProperties;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventAggregationService {

  private static final Logger log = LoggerFactory.getLogger(EventAggregationService.class);

  private final AggregationRepository aggregationRepository;
  private final AnalyticsProperties properties;

  public EventAggregationService(
      AggregationRepository aggregationRepository,
      AnalyticsProperties properties
  ) {
    this.aggregationRepository = aggregationRepository;
    this.properties = properties;
  }

  @Scheduled(fixedDelayString = "${analytics.aggregation.fixed-delay-ms}")
  public void runScheduledAggregation() {
    runAggregationOnce();
  }

  @Transactional
  public void runAggregationOnce() {
    Instant upperBound = Instant.now()
        .minusSeconds(properties.getAggregation().getLagSeconds())
        .truncatedTo(ChronoUnit.SECONDS);

    Instant lastProcessedAt = aggregationRepository.lockAndGetLastProcessedAt();
    Instant lookbackStart = upperBound.minus(
        properties.getAggregation().getLookbackHours(),
        ChronoUnit.HOURS
    );

    Instant from = lastProcessedAt.isBefore(lookbackStart) ? lastProcessedAt : lookbackStart;
    from = from.truncatedTo(ChronoUnit.HOURS);

    if (!upperBound.isAfter(from)) {
      return;
    }

    List<AggregatedBucket> rows = aggregationRepository.aggregateRange(from, upperBound);
    aggregationRepository.deleteMetricsRange(from, upperBound);
    aggregationRepository.upsertMetrics(rows);
    aggregationRepository.updateLastProcessedAt(upperBound);

    log.info(
        "Aggregation completed. from={}, to={}, buckets={}",
        from,
        upperBound,
        rows.size()
    );
  }
}
