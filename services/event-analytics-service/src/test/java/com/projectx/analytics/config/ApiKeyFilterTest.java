package com.projectx.analytics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.*;

@DisplayName("ApiKeyFilter — Unit Tests")
class ApiKeyFilterTest {

    private static final String VALID_KEY = "secure-api-key-123";
    private ApiKeyFilter filter;

    @BeforeEach
    void setUp() {
        AnalyticsProperties props = new AnalyticsProperties();
        props.getSecurity().setApiKey(VALID_KEY);
        filter = new ApiKeyFilter(props, new ObjectMapper());
    }

    @Test
    @DisplayName("should pass request with valid API key")
    void validApiKey() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/events");
        request.addHeader("X-Events-Api-Key", VALID_KEY);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull(); // chain was invoked
    }

    @Test
    @DisplayName("should block request without API key")
    void missingApiKey() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/analytics/funnel");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("Invalid API key");
        assertThat(chain.getRequest()).isNull(); // chain was NOT invoked
    }

    @Test
    @DisplayName("should block request with wrong API key")
    void wrongApiKey() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/events");
        request.addHeader("X-Events-Api-Key", "wrong-key");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    @DisplayName("should skip filtering for /actuator/health")
    void skipActuatorHealth() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
        assertThat(filter.shouldNotFilter(request)).isTrue();
    }

    @Test
    @DisplayName("should skip filtering for /actuator/info")
    void skipActuatorInfo() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/info");
        assertThat(filter.shouldNotFilter(request)).isTrue();
    }

    @Test
    @DisplayName("should NOT skip filtering for API routes")
    void doNotSkipApiRoutes() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/analytics/funnel");
        assertThat(filter.shouldNotFilter(request)).isFalse();
    }

    @Test
    @DisplayName("should skip filtering for non-API routes")
    void skipNonApiRoutes() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        assertThat(filter.shouldNotFilter(request)).isTrue();
    }
}
