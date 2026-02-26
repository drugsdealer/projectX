package com.projectx.analytics.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "analytics")
public class AnalyticsProperties {

  @Valid
  private final Security security = new Security();

  @Valid
  private final Aggregation aggregation = new Aggregation();

  public Security getSecurity() {
    return security;
  }

  public Aggregation getAggregation() {
    return aggregation;
  }

  public static class Security {
    @NotBlank
    private String apiKey = "local-dev-key";

    public String getApiKey() {
      return apiKey;
    }

    public void setApiKey(String apiKey) {
      this.apiKey = apiKey;
    }
  }

  public static class Aggregation {
    @Min(5_000)
    private long fixedDelayMs = 60_000;

    @Min(0)
    @Max(300)
    private long lagSeconds = 30;

    @Min(1)
    @Max(72)
    private int lookbackHours = 6;

    public long getFixedDelayMs() {
      return fixedDelayMs;
    }

    public void setFixedDelayMs(long fixedDelayMs) {
      this.fixedDelayMs = fixedDelayMs;
    }

    public long getLagSeconds() {
      return lagSeconds;
    }

    public void setLagSeconds(long lagSeconds) {
      this.lagSeconds = lagSeconds;
    }

    public int getLookbackHours() {
      return lookbackHours;
    }

    public void setLookbackHours(int lookbackHours) {
      this.lookbackHours = lookbackHours;
    }
  }
}
