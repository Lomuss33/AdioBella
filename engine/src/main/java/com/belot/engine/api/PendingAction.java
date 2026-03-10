package com.belot.engine.api;

import java.util.List;

public record PendingAction(
        ActionType type,
        String actingPlayerId,
        List<Integer> legalCardIndices,
        List<String> legalTrumpChoices,
        String validationMessage,
        String prompt
) {
}
