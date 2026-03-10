package com.belot.engine.api;

public record CardView(
        String suit,
        String rank,
        String label,
        boolean faceUp,
        boolean playable
) {
}
