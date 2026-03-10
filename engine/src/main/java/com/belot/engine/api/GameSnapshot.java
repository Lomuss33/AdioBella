package com.belot.engine.api;

import java.util.List;

public record GameSnapshot(
        String phase,
        String trumpSuit,
        String dealerPlayerId,
        String declarerPlayerId,
        String currentPlayerId,
        List<PlayerView> players,
        TrickView trick,
        ScoreView score,
        PendingAction pendingAction,
        long lastEventSequence,
        boolean matchComplete
) {
}
