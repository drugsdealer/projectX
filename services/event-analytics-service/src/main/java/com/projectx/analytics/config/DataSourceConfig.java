package com.projectx.analytics.config;

import com.zaxxer.hikari.HikariDataSource;
import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class DataSourceConfig {

  private static final Set<String> PRISMA_ONLY_PARAMS = Set.of(
      "pgbouncer",
      "connection_limit",
      "pool_timeout"
  );

  @Bean
  public DataSource dataSource(Environment env) {
    String rawUrl = firstNonBlank(
        env.getProperty("EVENTS_DB_URL"),
        env.getProperty("DATABASE_URL"),
        readUrlFromEnvFiles(),
        env.getProperty("spring.datasource.url")
    );

    if (rawUrl == null) {
      throw new IllegalStateException("Set EVENTS_DB_URL or DATABASE_URL for event-analytics-service");
    }

    String jdbcUrl = normalizeJdbcUrl(rawUrl.trim());

    HikariDataSource dataSource = new HikariDataSource();
    dataSource.setJdbcUrl(jdbcUrl);

    String username = env.getProperty("EVENTS_DB_USERNAME");
    String password = env.getProperty("EVENTS_DB_PASSWORD");
    if (username != null && !username.isBlank()) {
      dataSource.setUsername(username);
    }
    if (password != null && !password.isBlank()) {
      dataSource.setPassword(password);
    }

    Integer maxPool = env.getProperty("EVENTS_DB_POOL_MAX", Integer.class);
    Integer minPool = env.getProperty("EVENTS_DB_POOL_MIN", Integer.class);
    if (maxPool != null) {
      dataSource.setMaximumPoolSize(maxPool);
    }
    if (minPool != null) {
      dataSource.setMinimumIdle(minPool);
    }

    return dataSource;
  }

  private String normalizeJdbcUrl(String rawUrl) {
    if (rawUrl.startsWith("jdbc:")) {
      return rawUrl;
    }

    String normalized = rawUrl;
    if (rawUrl.startsWith("postgres://")) {
      normalized = "postgresql://" + rawUrl.substring("postgres://".length());
    }

    if (normalized.startsWith("postgresql://")) {
      return fromPrismaLikePostgresUrl(normalized);
    }

    throw new IllegalArgumentException("Unsupported DB URL format. Use postgresql://... or jdbc:postgresql://...");
  }

  private String fromPrismaLikePostgresUrl(String rawUrl) {
    URI uri = URI.create(rawUrl);

    String host = uri.getHost();
    if (host == null || host.isBlank()) {
      throw new IllegalArgumentException("DB URL host is missing");
    }

    String path = uri.getPath();
    if (path == null || path.isBlank() || "/".equals(path)) {
      throw new IllegalArgumentException("DB URL database name is missing");
    }

    Map<String, String> params = new LinkedHashMap<>();
    String query = uri.getRawQuery();
    if (query != null && !query.isBlank()) {
      for (String part : query.split("&")) {
        if (part.isBlank()) {
          continue;
        }
        String[] kv = part.split("=", 2);
        String key = decode(kv[0]);
        String value = kv.length > 1 ? decode(kv[1]) : "";
        if (PRISMA_ONLY_PARAMS.contains(key)) {
          continue;
        }
        params.put(key, value);
      }
    }

    if (params.containsKey("schema") && !params.containsKey("currentSchema")) {
      params.put("currentSchema", params.get("schema"));
      params.remove("schema");
    }

    String userInfo = uri.getRawUserInfo();
    if (userInfo != null && !userInfo.isBlank()) {
      String[] up = userInfo.split(":", 2);
      if (up.length > 0 && !up[0].isBlank()) {
        params.putIfAbsent("user", decode(up[0]));
      }
      if (up.length > 1 && !up[1].isBlank()) {
        params.putIfAbsent("password", decode(up[1]));
      }
    }

    StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
        .append(host);
    if (uri.getPort() > 0) {
      jdbc.append(":").append(uri.getPort());
    }
    jdbc.append(path);

    if (!params.isEmpty()) {
      jdbc.append("?");
      boolean first = true;
      for (Map.Entry<String, String> entry : params.entrySet()) {
        if (!first) {
          jdbc.append("&");
        }
        jdbc.append(entry.getKey()).append("=").append(entry.getValue());
        first = false;
      }
    }

    return jdbc.toString();
  }

  private String decode(String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return null;
  }

  private String readUrlFromEnvFiles() {
    Path cwd = Paths.get("").toAbsolutePath();
    Path[] candidates = new Path[] {
        cwd.resolve(".env"),
        cwd.resolve("../.env").normalize(),
        cwd.resolve("../../.env").normalize()
    };

    for (Path candidate : candidates) {
      if (!Files.exists(candidate) || !Files.isRegularFile(candidate)) {
        continue;
      }
      try {
        for (String line : Files.readAllLines(candidate, StandardCharsets.UTF_8)) {
          String trimmed = line.trim();
          if (trimmed.isEmpty() || trimmed.startsWith("#")) {
            continue;
          }
          if (trimmed.startsWith("DATABASE_URL=")) {
            return trimmed.substring("DATABASE_URL=".length()).trim();
          }
          if (trimmed.startsWith("EVENTS_DB_URL=")) {
            return trimmed.substring("EVENTS_DB_URL=".length()).trim();
          }
        }
      } catch (IOException ignored) {
        // Keep scanning other candidates.
      }
    }
    return null;
  }
}
