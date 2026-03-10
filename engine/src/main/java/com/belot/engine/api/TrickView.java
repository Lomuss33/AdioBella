package com.belot.engine.api;

import java.util.List;

public record TrickView(
        String leadPlayerId,
        List<PlayedCardView> cards
) {
}
