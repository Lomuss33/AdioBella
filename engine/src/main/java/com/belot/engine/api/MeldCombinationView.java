package com.belot.engine.api;

import java.util.List;

public record MeldCombinationView(
        String kind,
        String label,
        int points,
        int comparisonValue,
        List<CardView> cards
) {
}
