package com.projectx.analytics.event.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BatchEventRequest(
    @NotEmpty
    @Size(max = 500)
    List<@Valid EventRequest> events
) {
}
