package com.belot.server.web;

import java.util.Map;
import com.belot.engine.api.GameRuleException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        String message = exception.getMessage();
        String code = exception instanceof GameRuleException rule ? rule.code() : "error.unknown";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "error", message == null || message.isBlank() ? "Request was rejected." : message,
                "code", code
        ));
    }
}
