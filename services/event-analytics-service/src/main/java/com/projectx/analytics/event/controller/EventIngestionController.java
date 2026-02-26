package com.projectx.analytics.event.controller;

import com.projectx.analytics.event.dto.BatchEventRequest;
import com.projectx.analytics.event.dto.EventAcceptedResponse;
import com.projectx.analytics.event.dto.EventRequest;
import com.projectx.analytics.event.service.EventIngestionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events")
public class EventIngestionController {

  private final EventIngestionService eventIngestionService;

  public EventIngestionController(EventIngestionService eventIngestionService) {
    this.eventIngestionService = eventIngestionService;
  }

  @PostMapping
  public ResponseEntity<EventAcceptedResponse> ingestOne(@Valid @RequestBody EventRequest request) {
    int accepted = eventIngestionService.ingestSingle(request);
    return ResponseEntity.accepted().body(new EventAcceptedResponse(accepted));
  }

  @PostMapping("/batch")
  public ResponseEntity<EventAcceptedResponse> ingestBatch(
      @Valid @RequestBody BatchEventRequest request
  ) {
    int accepted = eventIngestionService.ingestBatch(request.events());
    return ResponseEntity.accepted().body(new EventAcceptedResponse(accepted));
  }
}
