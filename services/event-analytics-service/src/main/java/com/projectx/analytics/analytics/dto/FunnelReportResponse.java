package com.projectx.analytics.analytics.dto;

import java.time.Instant;
import java.util.List;

public record FunnelReportResponse(
    Instant from,
    Instant to,
    double overallConversion,
    List<FunnelStepResponse> steps
) {
}
