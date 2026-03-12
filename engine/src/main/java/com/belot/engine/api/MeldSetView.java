package com.belot.engine.api;

import java.util.List;

public record MeldSetView(
        String playerId,
        String playerName,
        String teamName,
        int totalPoints,
        List<MeldCombinationView> melds
) {
}
