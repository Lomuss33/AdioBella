package com.belot.engine.api;

public record PlayedCardView(
        String playerId,
        String playerName,
        String seat,
        CardView card
) {
}
