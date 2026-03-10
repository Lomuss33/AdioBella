package com.belot.engine.api;

import java.util.List;

public record ScoreView(
        String teamOneName,
        int teamOneMatchScore,
        int teamOneGamePoints,
        String teamTwoName,
        int teamTwoMatchScore,
        int teamTwoGamePoints,
        String declarerTeam,
        int gameNumber,
        String difficulty,
        int teamOneMeldPoints,
        int teamTwoMeldPoints,
        List<MeldDeclarationView> meldDeclarations
) {
}
