package com.belot.engine.api;

/** Stable client-facing error identity; English text remains for legacy consumers. */
public final class GameRuleException extends IllegalArgumentException {
    private final String code;
    public GameRuleException(String code, String message) {
        super(message);
        this.code = code;
    }
    public String code() { return code; }
}
