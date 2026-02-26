package com.projectx.analytics;

import com.projectx.analytics.config.AnalyticsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(AnalyticsProperties.class)
public class EventAnalyticsApplication {

  public static void main(String[] args) {
    SpringApplication.run(EventAnalyticsApplication.class, args);
  }
}
