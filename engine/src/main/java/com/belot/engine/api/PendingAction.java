package com.belot.engine.api;

import java.util.List;

public record PendingAction(
        ActionType type,
        String actingPlayerId,
        List<Integer> legalCardIndices,
        List<String> legalTrumpChoices,
        List<Integer> belaEligibleCardIndices,
        List<MeldSetView> availableMelds,
        MeldWinnerView meldWinner,
        String validationMessage,
        String prompt
) {
}
