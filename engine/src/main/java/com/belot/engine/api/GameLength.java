package com.belot.engine.api;

public enum GameLength {
    SHORT(501),
    LONG(1001);

    private final int targetPoints;

    GameLength(int targetPoints) {
        this.targetPoints = targetPoints;
    }

    public int targetPoints() {
        return targetPoints;
    }
}
