package com.belot.engine.api;

import java.util.List;

public record MeldDeclarationView(
        String playerId,
        String playerName,
        String teamName,
        int meldPoints,
        int belaPoints,
        List<String> labels
) {
}
