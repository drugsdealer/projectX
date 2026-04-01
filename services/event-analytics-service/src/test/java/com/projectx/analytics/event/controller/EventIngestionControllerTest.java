package com.projectx.analytics.event.controller;

import com.projectx.analytics.event.service.EventIngestionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(EventIngestionController.class)
@DisplayName("EventIngestionController — Integration Tests")
class EventIngestionControllerTest {

    private static final String API_KEY = "test-api-key";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EventIngestionService eventIngestionService;

    // ========== POST /api/v1/events ==========

    @Nested
    @DisplayName("POST /api/v1/events")
    class SingleEvent {

        @Test
        @DisplayName("should accept a valid event and return 202")
        void acceptValidEvent() throws Exception {
            when(eventIngestionService.ingestSingle(any())).thenReturn(1);

            mockMvc.perform(post("/api/v1/events")
                            .header("X-Events-Api-Key", API_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "eventType": "PRODUCT_VIEW",
                                      "sessionId": "sess-123",
                                      "productId": 42,
                                      "pageUrl": "/product/42"
                                    }
                                    """))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.accepted").value(1));
        }

        @Test
        @DisplayName("should return 401 without API key")
        void rejectWithoutApiKey() throws Exception {
            mockMvc.perform(post("/api/v1/events")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "eventType": "PRODUCT_VIEW",
                                      "sessionId": "sess-123"
                                    }
                                    """))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("Invalid API key"));
        }

        @Test
        @DisplayName("should return 401 with wrong API key")
        void rejectWithWrongApiKey() throws Exception {
            mockMvc.perform(post("/api/v1/events")
                            .header("X-Events-Api-Key", "wrong-key")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "eventType": "PRODUCT_VIEW",
                                      "sessionId": "sess-123"
                                    }
                                    """))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 400 when eventType is missing")
        void missingEventType() throws Exception {
            mockMvc.perform(post("/api/v1/events")
                            .header("X-Events-Api-Key", API_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "sessionId": "sess-123"
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        @DisplayName("should return 400 when sessionId is missing")
        void missingSessionId() throws Exception {
            mockMvc.perform(post("/api/v1/events")
                            .header("X-Events-Api-Key", API_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "eventType": "PRODUCT_VIEW"
                                    }
                                    """))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("should return 400 for invalid eventType (handled by service)")
        void invalidEventType() throws Exception {
            when(eventIngestionService.ingestSingle(any()))
                    .thenThrow(new IllegalArgumentException("Unsupported eventType: CLICK"));

            mockMvc.perform(post("/api/v1/events")
                            .header("X-Events-Api-Key", API_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "eventType": "CLICK",
                                      "sessionId": "sess-123"
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Unsupported eventType: CLICK"));
        }

        @Test
        @DisplayName("should accept event with full payload including metadata")
        void fullPayload() throws Exception {
            when(eventIngestionService.ingestSingle(any())).thenReturn(1);

            mockMvc.perform(post("/api/v1/events")
                            .header("X-Events-Api-Key", API_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "eventType": "PURCHASE",
                                      "userId": 100,
                                      "sessionId": "sess-xyz",
                                      "productId": 55,
                                      "orderId": 777,
                                      "pageUrl": "/checkout/success",
                                      "source": "next-api",
                                      "deviceType": "mobile",
                                      "occurredAt": "2025-06-15T10:30:00Z",
                                      "metadata": {
                                        "quantity": 2,
                                        "price": 4990
                                      }
                                    }
                                    """))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.accepted").value(1));
        }
    }

    // ========== POST /api/v1/events/batch ==========

    @Nested
    @DisplayName("POST /api/v1/events/batch")
    class BatchEvents {

        @Test
        @DisplayName("should accept a valid batch and return 202")
        void acceptValidBatch() throws Exception {
            when(eventIngestionService.ingestBatch(anyList())).thenReturn(2);

            mockMvc.perform(post("/api/v1/events/batch")
                            .header("X-Events-Api-Key", API_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "events": [
                                        {
                                          "eventType": "PRODUCT_VIEW",
                                          "sessionId": "sess-1",
                                          "productId": 10
                                        },
                                        {
                                          "eventType": "ADD_TO_CART",
                                          "sessionId": "sess-1",
                                          "productId": 10
                                        }
                                      ]
                                    }
                                    """))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.accepted").value(2));
        }

        @Test
        @DisplayName("should return 400 for empty events array")
        void emptyEventsArray() throws Exception {
            mockMvc.perform(post("/api/v1/events/batch")
                            .header("X-Events-Api-Key", API_KEY)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "events": []
                                    }
                                    """))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("should return 401 without API key")
        void batchWithoutApiKey() throws Exception {
            mockMvc.perform(post("/api/v1/events/batch")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "events": [
                                        {
                                          "eventType": "PRODUCT_VIEW",
                                          "sessionId": "s1"
                                        }
                                      ]
                                    }
                                    """))
                    .andExpect(status().isUnauthorized());
        }
    }
}
