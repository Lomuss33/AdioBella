package com.belot.engine.api;

import java.util.List;

public record MeldWinnerView(
        String teamName,
        List<MeldSetView> players
) {
}
