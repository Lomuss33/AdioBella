package com.belot.engine.api;

import java.time.Instant;
import java.util.Map;

public record GameEvent(
        long sequence,
        String type,
        String message,
        Instant createdAt,
        Map<String, String> payload
) {
}
