package com.belot.engine.api;

import java.util.List;

public record MeldDeclarationView(
        String playerId,
        String playerName,
        String teamName,
        int meldPoints,
        int belaPoints,
        List<String> labels,
        List<MeldCombinationView> melds
) {
    public MeldDeclarationView(String playerId, String playerName, String teamName, int meldPoints, int belaPoints, List<String> labels) {
        this(playerId, playerName, teamName, meldPoints, belaPoints, labels, List.of());
    }
}
