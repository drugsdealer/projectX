package com.projectx.analytics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ApiKeyFilter extends OncePerRequestFilter {

  private static final String HEADER_NAME = "X-Events-Api-Key";
  private final AnalyticsProperties properties;
  private final ObjectMapper objectMapper;

  public ApiKeyFilter(AnalyticsProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();
    if (path == null || path.isBlank()) {
      return true;
    }
    return path.startsWith("/actuator/health")
        || path.startsWith("/actuator/info")
        || !path.startsWith("/api/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    String providedApiKey = request.getHeader(HEADER_NAME);
    String expectedApiKey = properties.getSecurity().getApiKey();

    if (expectedApiKey.equals(providedApiKey)) {
      filterChain.doFilter(request, response);
      return;
    }

    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    objectMapper.writeValue(
        response.getOutputStream(),
        Map.of("success", false, "message", "Invalid API key")
    );
  }
}
