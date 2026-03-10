package com.belot.engine.api;

import java.util.List;

public record PlayerView(
        String id,
        String name,
        String seat,
        boolean human,
        String team,
        List<CardView> hand,
        int handSize,
        int matchScore,
        int gamePoints,
        boolean dealer,
        boolean currentTurn
) {
}
