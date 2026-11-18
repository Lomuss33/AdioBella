package com.belot.engine.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

public final class BelotMatchFacade {

    private static final int DEFAULT_MATCH_TARGET_WINS = 3;
    private static final int FULL_HAND_SIZE = 8;
    private static final int OPENING_DEAL_SIZE = 6;
    private static final int LAST_TRICK_BONUS = 10;

    private final Random random;
    private final List<GameEvent> events = new ArrayList<>();

    private MatchState state;
    private long nextSequence;

    public BelotMatchFacade() {
        this(new Random(), Difficulty.NORMAL);
    }

    public BelotMatchFacade(Random random) {
        this(random, Difficulty.NORMAL);
    }

    public BelotMatchFacade(Random random, Difficulty difficulty) {
        this.random = Objects.requireNonNull(random);
        createNewMatch(difficulty);
    }

    public synchronized void createNewMatch(Difficulty difficulty) {
        events.clear();
        nextSequence = 1L;
        state = MatchState.create(difficulty);
        log("INFO", "New Belot session created.", Map.of("eventKind", "SESSION_CREATED", "difficulty", difficulty.name()));
    }

    public synchronized void startMatch() {
        ensure(state.phase == Phase.READY_TO_START || state.phase == Phase.BETWEEN_GAMES, "MATCH_RUNNING", "The match is already running.");
        clearValidation();
        if (state.phase == Phase.READY_TO_START) {
            startNextGame(false);
        } else {
            startNextFullGame(true);
        }
        processUntilHumanTurn();
    }

    /** Server-controlled seats; never accept this directly from an unauthenticated client. */
    public synchronized void configureHumanPlayers(java.util.Set<String> playerIds) {
        ensure(state.phase == Phase.READY_TO_START, "LOBBY_LOCKED", "Seats are locked after the match starts.");
        if (playerIds == null || !playerIds.contains("south")
                || playerIds.stream().anyMatch(id -> state.players.stream().noneMatch(player -> player.id.equals(id)))) {
            throw new IllegalArgumentException("Choose valid player seats including the host.");
        }
        state.players.forEach(player -> player.human = playerIds.contains(player.id));
    }

    public synchronized void updatePlayerNames(Map<String, String> playerNamesBySeat) {
        ensure(state.phase == Phase.READY_TO_START, "PLAYER_NAMES_LOCKED", "Player names can only be changed before the match starts.");
        if (playerNamesBySeat == null || playerNamesBySeat.isEmpty()) {
            return;
        }

        for (PlayerState player : state.players) {
            String proposedName = playerNamesBySeat.get(player.seat.name());
            if (proposedName == null) {
                continue;
            }

            String sanitized = proposedName.trim();
            if (!sanitized.isEmpty()) {
                player.name = sanitized;
            }
        }

        log("INFO", "Player names updated.", Map.of("eventKind", "PLAYER_NAMES_UPDATED"));
    }

    public synchronized void updateTeamNames(String yourTeamName, String enemyTeamName) {
        ensure(state.phase == Phase.READY_TO_START, "TEAM_NAMES_LOCKED", "Team names can only be changed before the match starts.");

        boolean changed = false;
        if (yourTeamName != null) {
            String sanitized = yourTeamName.trim();
            if (!sanitized.isEmpty()) {
                state.teamOne.name = sanitized;
                changed = true;
            }
        }

        if (enemyTeamName != null) {
            String sanitized = enemyTeamName.trim();
            if (!sanitized.isEmpty()) {
                state.teamTwo.name = sanitized;
                changed = true;
            }
        }

        if (changed) {
            log("INFO", "Team names updated.", Map.of("eventKind", "TEAM_NAMES_UPDATED"));
        }
    }

    public synchronized void updateLobbySettings(
            Difficulty difficulty,
            Map<String, String> playerNamesBySeat,
            String yourTeamName,
            String enemyTeamName,
            Integer matchTargetWins,
            GameLength gameLength
    ) {
        ensure(state.phase == Phase.READY_TO_START, "LOBBY_LOCKED", "Lobby settings can only be changed before the match starts.");
        if (difficulty != null) {
            state.difficulty = difficulty;
        }
        updateGameSettings(matchTargetWins, gameLength);
        updateTeamNames(yourTeamName, enemyTeamName);
        updatePlayerNames(playerNamesBySeat);
    }

    public synchronized void updateGameSettings(Integer matchTargetWins, GameLength gameLength) {
        ensure(state.phase == Phase.READY_TO_START, "GAME_SETTINGS_LOCKED", "Game settings can only be changed before the match starts.");

        if (matchTargetWins != null) {
            state.matchTargetWins = sanitizeMatchTargetWins(matchTargetWins);
        }

        if (gameLength != null) {
            state.gameTargetPoints = gameLength.targetPoints();
        }
    }

    public synchronized void chooseTrump(TrumpChoice choice) {
        ensurePending(ActionType.CHOOSE_TRUMP);
        clearValidation();

        if (choice == null) {
            reject("CHOOSE_TRUMP", "Choose a trump suit or skip.");
        }

        if (choice == TrumpChoice.SKIP && state.trumpTurnOffset == 3) {
            reject("TRUMP_REQUIRED", "The last player must choose a trump suit.");
        }

        if (choice == TrumpChoice.SKIP) {
            PlayerState player = currentPlayer();
            log("ACTION", player.name + " skipped trump selection.", Map.of(
                    "eventKind", "TRUMP_SKIP",
                    "playerId", player.id,
                    "playerName", player.name,
                    "playerSeat", player.seat.name()
            ));
            advanceTrumpTurn();
            processUntilHumanTurn();
            return;
        }

        selectTrump(currentPlayer(), toSuit(choice));
        processUntilHumanTurn();
    }

    public synchronized void playCard(int handIndex) {
        playCard(handIndex, false);
    }

    public synchronized void playCard(int handIndex, boolean callBela) {
        ensurePending(ActionType.PLAY_CARD);
        clearValidation();

        List<Integer> legal = legalCardIndices(currentPlayer());
        if (!legal.contains(handIndex)) {
            reject("ILLEGAL_CARD", "That card is not legal in the current trick.");
        }

        playCardInternal(handIndex, callBela);
        processUntilHumanTurn();
    }

    public synchronized void forfeitGame() {
        forfeitGame("south");
    }

    public synchronized void forfeitGame(String playerId) {
        ensure(state.phase != Phase.READY_TO_START, "GAME_NOT_STARTED", "Start the match before forfeiting a game.");
        ensure(state.phase != Phase.BETWEEN_GAMES, "GAME_COMPLETE", "The current game is already complete.");
        ensure(state.phase != Phase.MATCH_COMPLETE, "MATCH_COMPLETE", "The match is already complete.");

        clearValidation();

        TeamState forfeitingTeam = requirePlayer(playerId).team;
        TeamState winningTeam = otherTeam(forfeitingTeam.side);
        winningTeam.gameScore = Math.max(winningTeam.gameScore, state.gameTargetPoints);
        clearCurrentHandState();

        log("INFO", forfeitingTeam.name + " forfeited the game. " + winningTeam.name + " won by forfeit.", Map.of(
                "eventKind", "GAME_FORFEIT",
                "forfeitingTeam", forfeitingTeam.name,
                "winner", winningTeam.name,
                "winningScore", String.valueOf(winningTeam.gameScore),
                "gameNumber", String.valueOf(state.gameNumber)
        ));

        finalizeGameWin(winningTeam, true);
    }

    public synchronized void forfeitMatch() {
        forfeitMatch("south");
    }

    public synchronized void forfeitMatch(String playerId) {
        ensure(state.phase != Phase.READY_TO_START, "MATCH_NOT_STARTED", "Start the match before forfeiting it.");
        ensure(state.phase != Phase.MATCH_COMPLETE, "MATCH_COMPLETE", "The match is already complete.");

        clearValidation();

        boolean gameInProgress = state.phase != Phase.BETWEEN_GAMES;
        TeamState forfeitingTeam = requirePlayer(playerId).team;
        TeamState winningTeam = otherTeam(forfeitingTeam.side);
        if (gameInProgress) winningTeam.gameScore = Math.max(winningTeam.gameScore, state.gameTargetPoints);
        winningTeam.matchWins = state.matchTargetWins;
        if (gameInProgress) clearCurrentHandState();

        log("INFO", forfeitingTeam.name + " forfeited the match. " + winningTeam.name + " won by forfeit.", Map.of(
                "eventKind", "MATCH_FORFEIT",
                "forfeitingTeam", forfeitingTeam.name,
                "winner", winningTeam.name,
                "winningScore", String.valueOf(winningTeam.gameScore),
                "gameNumber", String.valueOf(state.gameNumber)
        ));
        if (gameInProgress) {
            log("INFO", winningTeam.name + " won the game.", Map.of(
                    "eventKind", "GAME_WIN",
                    "winner", winningTeam.name,
                    "winningScore", String.valueOf(winningTeam.gameScore),
                    "matchWins", String.valueOf(winningTeam.matchWins),
                    "gameNumber", String.valueOf(state.gameNumber),
                    "byForfeit", "true"
            ));
        }

        state.phase = Phase.MATCH_COMPLETE;
        state.pendingType = ActionType.NONE;
        state.pendingValidationMessage = null;
        state.pendingValidationCode = null;
        state.currentTrick = null;
        log("INFO", winningTeam.name + " won the match.", Map.of(
                "eventKind", "MATCH_WIN",
                "winner", winningTeam.name,
                "matchWins", String.valueOf(winningTeam.matchWins),
                "gameNumber", String.valueOf(state.gameNumber),
                "byForfeit", "true"
        ));
    }

    public synchronized void reportMelds(boolean declare) {
        ensurePending(ActionType.REPORT_MELDS);
        clearValidation();

        if (state.humanMeldOffer == null || state.humanMeldOffer.totalPoints() == 0) {
            reject("NO_MELDS", "There are no melds to report.");
        }

        if (declare) {
            state.declaredMeldSets.add(state.humanMeldOffer);
            log("INFO", state.humanMeldOffer.player().name + " declared melds.", Map.of(
                    "eventKind", "MELDS_DECLARE",
                    "playerId", state.humanMeldOffer.player().id,
                    "playerName", state.humanMeldOffer.player().name,
                    "playerSeat", state.humanMeldOffer.player().seat.name(),
                    "team", state.humanMeldOffer.player().team.name,
                    "points", String.valueOf(state.humanMeldOffer.totalPoints())
            ));
        } else {
            log("INFO", state.humanMeldOffer.player().name + " passed on melds.", Map.of(
                    "eventKind", "MELDS_PASS",
                    "playerId", state.humanMeldOffer.player().id,
                    "playerName", state.humanMeldOffer.player().name,
                    "playerSeat", state.humanMeldOffer.player().seat.name()
            ));
        }

        state.humanMeldOffer = null;
        if (!state.pendingHumanMeldOffers.isEmpty()) {
            state.humanMeldOffer = state.pendingHumanMeldOffers.remove(0);
            return;
        }
        finalizeMeldDeclarations();
        processUntilHumanTurn();
    }

    public synchronized void acknowledgeMelds() {
        ensurePending(ActionType.ACKNOWLEDGE_MELDS);
        clearValidation();
        state.pendingMeldWinner = null;
        state.pendingType = ActionType.NONE;
        processUntilHumanTurn();
    }

    public synchronized GameSnapshot getSnapshot() {
        return getSnapshotForPlayer("south");
    }

    public synchronized GameSnapshot getSnapshotForPlayer(String playerId) {
        requirePlayer(playerId);
        PendingAction pendingAction = buildPendingAction();
        if (!playerId.equals(pendingAction.actingPlayerId())) {
            pendingAction = new PendingAction(ActionType.NONE, pendingAction.actingPlayerId(), List.of(), List.of(),
                    List.of(), List.of(), null, null, null, "Waiting for another player.");
        }
        List<Integer> legalCardIndices = pendingAction.type() == ActionType.PLAY_CARD
                ? pendingAction.legalCardIndices()
                : List.of();

        List<PlayerView> players = state.players.stream()
                .map(player -> toPlayerView(player, legalCardIndices, playerId))
                .toList();

        TrickView trick = new TrickView(
                state.currentTrick == null ? null : playerAt(state.currentTrick.leadPlayerIndex).id,
                state.currentTrick == null ? List.of() : state.currentTrick.cards.stream().map(this::toPlayedCardView).toList()
        );

        ScoreView score = new ScoreView(
                state.teamOne.name,
                state.teamOne.matchWins,
                displayedGameScore(state.teamOne),
                state.teamTwo.name,
                state.teamTwo.matchWins,
                displayedGameScore(state.teamTwo),
                state.declarer == null ? null : teamFor(state.declarer).name,
                state.gameNumber,
                state.difficulty.name(),
                state.matchTargetWins,
                state.gameTargetPoints,
                state.teamOne.meldPoints,
                state.teamTwo.meldPoints,
                meldDeclarations()
        );

        return new GameSnapshot(
                state.phase.name(),
                state.trumpSuit == null ? null : state.trumpSuit.name(),
                playerAt(state.dealerIndex).id,
                state.declarerPlayerIndex == null ? null : playerAt(state.declarerPlayerIndex).id,
                state.phase == Phase.READY_TO_START || state.phase == Phase.BETWEEN_GAMES || state.phase == Phase.MATCH_COMPLETE ? null : currentPlayer().id,
                players,
                trick,
                score,
                pendingAction,
                nextSequence - 1,
                state.phase == Phase.MATCH_COMPLETE
        );
    }

    public synchronized List<GameEvent> getEventsAfter(long sequence) {
        return events.stream().filter(event -> event.sequence() > sequence).toList();
    }

    private void processUntilHumanTurn() {
        while (true) {
            if (state.phase == Phase.MATCH_COMPLETE || state.phase == Phase.READY_TO_START || state.phase == Phase.BETWEEN_GAMES) {
                return;
            }

            if (state.pendingType == ActionType.REPORT_MELDS || state.pendingType == ActionType.ACKNOWLEDGE_MELDS) {
                return;
            }

            if (state.phase == Phase.TRUMP_SELECTION) {
                PlayerState player = currentPlayer();
                if (player.human) {
                    state.pendingType = ActionType.CHOOSE_TRUMP;
                    return;
                }

                TrumpChoice choice = BelotAiAndRules.chooseTrumpForAi(player, state.trumpTurnOffset == 3, state.difficulty);
                if (choice == TrumpChoice.SKIP) {
                    log("ACTION", player.name + " skipped trump selection.", Map.of(
                            "eventKind", "TRUMP_SKIP",
                            "playerId", player.id,
                            "playerName", player.name,
                            "playerSeat", player.seat.name()
                    ));
                    advanceTrumpTurn();
                    continue;
                }

                selectTrump(player, toSuit(choice));
                continue;
            }

            if (!state.firstTrickAnnounced && state.currentTrick != null && state.currentTrick.cards.isEmpty()) {
                state.firstTrickAnnounced = true;
                log("INFO", playerAt(state.currentPlayerIndex).name + " leads the first trick.", Map.of(
                        "eventKind", "TRICK_LEAD",
                        "playerName", playerAt(state.currentPlayerIndex).name,
                        "playerId", playerAt(state.currentPlayerIndex).id,
                        "playerSeat", playerAt(state.currentPlayerIndex).seat.name()
                ));
            }

            if (state.players.stream().allMatch(player -> player.hand.isEmpty())) {
                finishGame();
                continue;
            }

            PlayerState player = currentPlayer();
            List<Integer> legal = legalCardIndices(player);
            if (player.human) {
                state.pendingType = ActionType.PLAY_CARD;
                return;
            }

            int chosenIndex = BelotAiAndRules.chooseCardForAi(player, legal, state.currentTrick, state.trumpSuit, state.difficulty, random);
            playCardInternal(chosenIndex, BelotAiAndRules.belaEligibleCardIndices(player, state.trumpSuit).contains(chosenIndex));
        }
    }

    private void playCardInternal(int handIndex, boolean callBela) {
        PlayerState player = currentPlayer();
        boolean belaEligible = BelotAiAndRules.isBelaEligible(player, handIndex, state.trumpSuit);
        if (callBela && !belaEligible) {
            reject("BELA_NOT_ALLOWED", "Bela cannot be called with that card.");
        }

        Card card = player.hand.remove(handIndex);
        if (belaEligible) {
            player.belaResolved = true;
            if (callBela) {
                player.belaCalled = true;
                player.team.meldPoints += 20;
                log("INFO", player.name + " called Bela.", Map.of(
                        "eventKind", "BELA_CALL",
                        "playerId", player.id,
                        "playerName", player.name,
                        "playerSeat", player.seat.name(),
                        "team", player.team.name,
                        "points", "20"
                ));
            }
        }
        state.currentTrick.cards.add(new PlayedCard(player.index, card));
        log("ACTION", player.name + " played " + card.label() + ".", Map.of(
                "eventKind", "PLAY_CARD",
                "playerId", player.id,
                "playerName", player.name,
                "playerSeat", player.seat.name(),
                "card", card.label(),
                "rank", card.rank.name(),
                "suit", card.suit.name()
        ));

        if (state.currentTrick.cards.size() < state.players.size()) {
            state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.size();
            state.pendingType = ActionType.NONE;
            return;
        }

        resolveTrick();
    }

    private void resolveTrick() {
        PlayedCard winningPlay = BelotAiAndRules.findWinningPlay(state.currentTrick.cards, state.trumpSuit);
        PlayerState winner = playerAt(winningPlay.playerIndex);
        int trickPoints = state.currentTrick.cards.stream().mapToInt(play -> play.card.points(state.trumpSuit)).sum();
        winner.team.trickPoints += trickPoints;
        winner.team.tricksWon += 1;

        boolean lastTrick = state.players.stream().allMatch(player -> player.hand.isEmpty());
        int lastTrickBonus = 0;
        if (lastTrick) {
            winner.team.trickPoints += LAST_TRICK_BONUS;
            trickPoints += LAST_TRICK_BONUS;
            lastTrickBonus = LAST_TRICK_BONUS;
        }

        log("SCORE", winner.name + " won the trick for " + trickPoints + " points.", Map.of(
                "eventKind", "TRICK_WIN",
                "winnerPlayerId", winner.id,
                "winnerPlayerName", winner.name,
                "winnerSeat", winner.seat.name(),
                "playerId", winner.id,
                "team", winner.team.name,
                "trickPoints", String.valueOf(trickPoints),
                "lastTrickBonus", String.valueOf(lastTrickBonus),
                "trickCardCount", String.valueOf(state.currentTrick.cards.size())
        ));

        if (lastTrick) {
            finishGame();
            return;
        }

        state.currentPlayerIndex = winner.index;
        state.currentTrick = new TrickState(winner.index);
        state.pendingType = ActionType.NONE;
    }

    private void finishGame() {
        int teamOnePoints = state.teamOne.totalHandPoints();
        int teamTwoPoints = state.teamTwo.totalHandPoints();
        TeamState declarer = teamFor(state.declarer);
        TeamState defenders = otherTeam(state.declarer);
        int totalPoints = teamOnePoints + teamTwoPoints;
        int teamOneAward = teamOnePoints;
        int teamTwoAward = teamTwoPoints;

        if (declarer.totalHandPoints() > defenders.totalHandPoints()) {
            state.teamOne.gameScore += teamOnePoints;
            state.teamTwo.gameScore += teamTwoPoints;
            log("SCORE", declarer.name + " passed the hand.", Map.ofEntries(
                    Map.entry("eventKind", "HAND_PASSED"),
                    Map.entry("team", declarer.name),
                    Map.entry("teamOneName", state.teamOne.name),
                    Map.entry("teamTwoName", state.teamTwo.name),
                    Map.entry("teamOnePoints", String.valueOf(teamOneAward)),
                    Map.entry("teamTwoPoints", String.valueOf(teamTwoAward)),
                    Map.entry("gameNumber", String.valueOf(state.gameNumber)),
                    Map.entry("dealerPlayerName", playerAt(state.dealerIndex).name),
                    Map.entry("trumpPlayerName", playerAt(state.declarerPlayerIndex).name),
                    Map.entry("trump", state.trumpSuit.name()),
                    Map.entry("meldWinner", meldWinnerName()),
                    Map.entry("meldPoints", String.valueOf(meldPointsAwarded()))
            ));
        } else {
            defenders.gameScore += totalPoints;
            teamOneAward = defenders == state.teamOne ? totalPoints : 0;
            teamTwoAward = defenders == state.teamTwo ? totalPoints : 0;
            log("SCORE", declarer.name + " failed the hand. " + defenders.name + " collected all " + totalPoints + " points.",
                    Map.ofEntries(
                            Map.entry("eventKind", "HAND_FAILED"),
                            Map.entry("team", declarer.name),
                            Map.entry("winner", defenders.name),
                            Map.entry("points", String.valueOf(totalPoints)),
                            Map.entry("teamOneName", state.teamOne.name),
                            Map.entry("teamTwoName", state.teamTwo.name),
                            Map.entry("teamOnePoints", String.valueOf(teamOneAward)),
                            Map.entry("teamTwoPoints", String.valueOf(teamTwoAward)),
                            Map.entry("gameNumber", String.valueOf(state.gameNumber)),
                            Map.entry("dealerPlayerName", playerAt(state.dealerIndex).name),
                            Map.entry("trumpPlayerName", playerAt(state.declarerPlayerIndex).name),
                            Map.entry("trump", state.trumpSuit.name()),
                            Map.entry("meldWinner", meldWinnerName()),
                            Map.entry("meldPoints", String.valueOf(meldPointsAwarded()))
                    ));
        }

        TeamState winner = state.teamOne.gameScore >= state.teamTwo.gameScore ? state.teamOne : state.teamTwo;
        if (winner.gameScore >= state.gameTargetPoints) {
            finalizeGameWin(winner, false);
            return;
        }

        startNextGame(true);
    }

    private String meldWinnerName() {
        return state.lastWinningMeldSets.isEmpty() ? "" : state.lastWinningMeldSets.get(0).player().team.name;
    }

    private int meldPointsAwarded() {
        return state.lastWinningMeldSets.stream().mapToInt(MeldSet::totalPoints).sum();
    }

    private void finalizeGameWin(TeamState winner, boolean byForfeit) {
        winner.matchWins += 1;
        log("INFO", winner.name + " won the game.", Map.of(
                "eventKind", "GAME_WIN",
                "winner", winner.name,
                "winningScore", String.valueOf(winner.gameScore),
                "matchWins", String.valueOf(winner.matchWins),
                "gameNumber", String.valueOf(state.gameNumber),
                "byForfeit", String.valueOf(byForfeit)
        ));

        if (winner.matchWins >= state.matchTargetWins) {
            state.phase = Phase.MATCH_COMPLETE;
            state.pendingType = ActionType.NONE;
            log("INFO", winner.name + " won the match.", Map.of(
                    "eventKind", "MATCH_WIN",
                    "winner", winner.name,
                    "matchWins", String.valueOf(winner.matchWins),
                    "gameNumber", String.valueOf(state.gameNumber),
                    "byForfeit", String.valueOf(byForfeit)
            ));
            return;
        }

        state.phase = Phase.BETWEEN_GAMES;
        state.pendingType = ActionType.START_NEXT_GAME;
        state.pendingValidationMessage = null;
        state.pendingValidationCode = null;
        state.currentTrick = null;
    }

    private void startNextFullGame(boolean rotateDealer) {
        state.teamOne.gameScore = 0;
        state.teamTwo.gameScore = 0;
        state.gameNumber++;
        startNextHand(rotateDealer);
        log("INFO", "Game " + state.gameNumber + " started. " + playerAt(state.dealerIndex).name + " is the dealer.",
                Map.of(
                        "eventKind", "GAME_START",
                        "gameNumber", String.valueOf(state.gameNumber),
                        "dealerPlayerName", playerAt(state.dealerIndex).name,
                        "dealerPlayerId", playerAt(state.dealerIndex).id
                ));
    }

    private void startNextGame(boolean rotateDealer) {
        if (state.gameNumber == 0) {
            startNextFullGame(rotateDealer);
            return;
        }

        startNextHand(rotateDealer);
    }

    private void startNextHand(boolean rotateDealer) {
        if (rotateDealer) {
            state.dealerIndex = (state.dealerIndex + 1) % state.players.size();
        }

        clearCurrentHandState();
        state.phase = Phase.TRUMP_SELECTION;
        state.pendingType = ActionType.NONE;
        state.pendingValidationMessage = null;
        state.pendingValidationCode = null;
        state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.size();
        state.deck = BelotAiAndRules.createShuffledDeck(random);
        dealCards(OPENING_DEAL_SIZE);
    }

    private void selectTrump(PlayerState player, Suit suit) {
        state.trumpSuit = suit;
        state.declarer = player.team.side;
        state.declarerPlayerIndex = player.index;
        log("ACTION", player.name + " chose " + suit.displayName + " as trump.",
                Map.of(
                        "eventKind", "TRUMP_CHOSEN",
                        "playerId", player.id,
                        "playerName", player.name,
                        "playerSeat", player.seat.name(),
                        "trump", suit.name()
                ));

        dealCards(FULL_HAND_SIZE - OPENING_DEAL_SIZE);

        for (PlayerState participant : state.players) {
            participant.hand.sort(Comparator.comparing((Card card) -> card.suit.ordinal()).thenComparing(card -> card.rank.ordinal()));
        }

        state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.size();
        state.currentTrick = new TrickState(state.currentPlayerIndex);
        state.phase = Phase.TRICK_PLAY;
        state.pendingType = ActionType.NONE;
        setupMeldFlow();
    }

    private void setupMeldFlow() {
        state.declaredMeldSets = new ArrayList<>();
        state.lastWinningMeldSets = List.of();
        state.pendingMeldWinner = null;
        state.humanMeldOffer = null;
        state.pendingHumanMeldOffers.clear();

        for (PlayerState player : state.players) {
            MeldSet meldSet = BelotMeldService.evaluate(player, state.trumpSuit);
            if (meldSet.totalPoints() == 0) {
                continue;
            }

            if (player.human) {
                state.pendingHumanMeldOffers.add(meldSet);
            } else {
                state.declaredMeldSets.add(meldSet);
                log("INFO", player.name + " declared melds.", Map.of(
                        "eventKind", "MELDS_DECLARE",
                        "playerId", player.id,
                        "playerName", player.name,
                        "playerSeat", player.seat.name(),
                        "team", player.team.name,
                        "points", String.valueOf(meldSet.totalPoints())
                ));
            }
        }

        if (!state.pendingHumanMeldOffers.isEmpty()) {
            state.humanMeldOffer = state.pendingHumanMeldOffers.remove(0);
            state.pendingType = ActionType.REPORT_MELDS;
            return;
        }

        finalizeMeldDeclarations();
    }

    private void finalizeMeldDeclarations() {
        MeldWinner winner = BelotMeldService.determineWinningMeldWinner(
                state.declaredMeldSets,
                state.declarer,
                side -> teamFor(side).name
        );
        if (winner == null) {
            state.lastWinningMeldSets = List.of();
            state.pendingMeldWinner = null;
            state.pendingType = ActionType.NONE;
            return;
        }

        state.lastWinningMeldSets = List.copyOf(winner.players());
        state.pendingMeldWinner = toMeldWinnerView(winner);
        teamFor(winner.team()).meldPoints += winner.totalPoints();

        log("INFO", winner.teamName() + " took melds.", Map.of(
                "eventKind", "MELDS_WIN",
                "team", winner.teamName(),
                "points", String.valueOf(winner.totalPoints())
        ));
        state.pendingType = ActionType.ACKNOWLEDGE_MELDS;
    }

    private void dealCards(int count) {
        for (int round = 0; round < count; round++) {
            for (int offset = 0; offset < state.players.size(); offset++) {
                PlayerState player = playerAt((state.dealerIndex + 1 + offset) % state.players.size());
                player.hand.add(state.deck.remove(0));
            }
        }
    }

    private List<Integer> legalCardIndices(PlayerState player) {
        return BelotAiAndRules.legalCardIndices(player.hand, state.currentTrick.cards, state.trumpSuit, player.team.side);
    }

    private PendingAction buildPendingAction() {
        return switch (state.pendingType) {
            case START_MATCH -> new PendingAction(ActionType.START_MATCH, playerAt(0).id, List.of(), List.of(), List.of(), List.of(), null, state.pendingValidationMessage,
                    state.pendingValidationCode, "Start the match.");
            case START_NEXT_GAME -> new PendingAction(ActionType.START_NEXT_GAME, playerAt(0).id, List.of(), List.of(), List.of(), List.of(), null, state.pendingValidationMessage,
                    state.pendingValidationCode, "Start the next game.");
            case CHOOSE_TRUMP -> new PendingAction(
                    ActionType.CHOOSE_TRUMP,
                    currentPlayer().id,
                    List.of(),
                    state.trumpTurnOffset == 3
                            ? List.of("SPADES", "HEARTS", "DIAMONDS", "CLUBS")
                            : List.of("SKIP", "SPADES", "HEARTS", "DIAMONDS", "CLUBS"),
                    List.of(),
                    List.of(),
                    null,
                    state.pendingValidationMessage,
                    state.pendingValidationCode,
                    state.trumpTurnOffset == 3 ? "Choose the trump suit." : "Choose the trump suit or skip."
            );
            case REPORT_MELDS -> new PendingAction(
                    ActionType.REPORT_MELDS,
                    state.humanMeldOffer.player().id,
                    List.of(),
                    List.of(),
                    List.of(),
                    state.humanMeldOffer == null ? List.of() : List.of(toMeldSetView(state.humanMeldOffer)),
                    null,
                    state.pendingValidationMessage,
                    state.pendingValidationCode,
                    "Declare melds or pass."
            );
            case ACKNOWLEDGE_MELDS -> new PendingAction(
                    ActionType.ACKNOWLEDGE_MELDS,
                    playerAt(0).id,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    state.pendingMeldWinner,
                    state.pendingValidationMessage,
                    state.pendingValidationCode,
                    "Review the melds and continue."
            );
            case PLAY_CARD -> new PendingAction(
                    ActionType.PLAY_CARD,
                    currentPlayer().id,
                    legalCardIndices(currentPlayer()),
                    List.of(),
                    BelotAiAndRules.belaEligibleCardIndices(currentPlayer(), state.trumpSuit),
                    List.of(),
                    null,
                    state.pendingValidationMessage,
                    state.pendingValidationCode,
                    "Play a legal card."
            );
            case NONE -> new PendingAction(ActionType.NONE, null, List.of(), List.of(), List.of(), List.of(), null, state.pendingValidationMessage,
                    state.pendingValidationCode, "");
        };
    }

    private PlayerView toPlayerView(PlayerState player, List<Integer> legalCardIndices, String viewerId) {
        List<CardView> hand = new ArrayList<>();
        if (player.id.equals(viewerId)) {
            for (int index = 0; index < player.hand.size(); index++) {
                Card card = player.hand.get(index);
                hand.add(new CardView(card.suit.name(), card.rank.name(), card.label(), true, legalCardIndices.contains(index)));
            }
        } else {
            for (int index = 0; index < player.hand.size(); index++) {
                hand.add(new CardView(null, null, "Hidden", false, false));
            }
        }

        return new PlayerView(
                player.id,
                player.name,
                player.seat.name(),
                player.human,
                player.team.name,
                hand,
                player.hand.size(),
                player.team.matchWins,
                displayedGameScore(player.team),
                player.index == state.dealerIndex,
                state.phase != Phase.READY_TO_START
                        && state.phase != Phase.BETWEEN_GAMES
                        && state.phase != Phase.MATCH_COMPLETE
                        && player.index == state.currentPlayerIndex
        );
    }

    private PlayedCardView toPlayedCardView(PlayedCard playedCard) {
        PlayerState player = playerAt(playedCard.playerIndex);
        Card card = playedCard.card;
        return new PlayedCardView(
                player.id,
                player.name,
                player.seat.name(),
                new CardView(card.suit.name(), card.rank.name(), card.label(), true, false)
        );
    }

    private List<MeldDeclarationView> meldDeclarations() {
        return state.players.stream().flatMap(player -> {
            MeldSet meldSet = state.lastWinningMeldSets.stream()
                    .filter(set -> set.player() == player).findFirst().orElse(null);
            if (meldSet == null && !player.belaCalled) {
                return java.util.stream.Stream.empty();
            }
            return java.util.stream.Stream.of(new MeldDeclarationView(
                    player.id, player.name, player.team.name,
                    meldSet == null ? 0 : meldSet.totalPoints(), player.belaCalled ? 20 : 0,
                    meldSet == null ? List.of() : meldSet.melds().stream().map(MeldCombination::label).toList(),
                    meldSet == null ? List.of() : meldSet.melds().stream().map(this::toMeldCombinationView).toList()
            ));
        }).toList();
    }

    private MeldSetView toMeldSetView(MeldSet meldSet) {
        return new MeldSetView(
                meldSet.player().id,
                meldSet.player().name,
                meldSet.player().team.name,
                meldSet.totalPoints(),
                meldSet.melds().stream().map(this::toMeldCombinationView).toList()
        );
    }

    private MeldCombinationView toMeldCombinationView(MeldCombination meldCombination) {
        return new MeldCombinationView(
                meldCombination.kind(),
                meldCombination.label(),
                meldCombination.points(),
                meldCombination.comparisonValue(),
                meldCombination.cards().stream().map(card -> new CardView(card.suit.name(), card.rank.name(), card.label(), true, false)).toList()
        );
    }

    private MeldWinnerView toMeldWinnerView(MeldWinner winner) {
        return new MeldWinnerView(
                winner.teamName(),
                winner.players().stream().map(this::toMeldSetView).toList()
        );
    }

    private void advanceTrumpTurn() {
        state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.size();
        state.trumpTurnOffset++;
        state.pendingType = ActionType.NONE;
    }

    private void ensurePending(ActionType expected) {
        ensure(state.pendingType == expected, "UNEXPECTED_ACTION", "That action is not expected right now.");
    }

    private void ensure(boolean condition, String code, String message) {
        if (!condition) {
            reject(code, message);
        }
    }

    private void reject(String code, String message) {
        state.pendingValidationMessage = message;
        state.pendingValidationCode = code;
        log("ERROR", message, Map.of("eventKind", "ERROR", "code", code));
        throw new GameRuleException(code, message);
    }

    private void clearValidation() {
        state.pendingValidationMessage = null;
        state.pendingValidationCode = null;
    }

    private void log(String type, String message, Map<String, String> payload) {
        events.add(new GameEvent(nextSequence++, type, message, Instant.now(), payload));
    }

    private PlayerState currentPlayer() {
        return playerAt(state.currentPlayerIndex);
    }

    private PlayerState requirePlayer(String playerId) {
        return state.players.stream().filter(player -> player.id.equals(playerId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown player."));
    }

    private PlayerState playerAt(int index) {
        return state.players.get(index);
    }

    private TeamState teamFor(TeamSide side) {
        return side == TeamSide.YOURS ? state.teamOne : state.teamTwo;
    }

    private TeamState otherTeam(TeamSide side) {
        return side == TeamSide.YOURS ? state.teamTwo : state.teamOne;
    }

    private void clearCurrentHandState() {
        state.trumpSuit = null;
        state.declarer = null;
        state.declarerPlayerIndex = null;
        state.trumpTurnOffset = 0;
        state.currentTrick = null;
        state.lastWinningMeldSets = List.of();
        state.declaredMeldSets = new ArrayList<>();
        state.humanMeldOffer = null;
        state.pendingHumanMeldOffers.clear();
        state.pendingMeldWinner = null;
        state.firstTrickAnnounced = false;
        state.teamOne.resetHandState();
        state.teamTwo.resetHandState();

        for (PlayerState player : state.players) {
            player.hand.clear();
            player.belaCalled = false;
            player.belaResolved = false;
        }
    }

    private int displayedGameScore(TeamState team) {
        if (state.phase == Phase.BETWEEN_GAMES || state.phase == Phase.MATCH_COMPLETE) {
            return team.gameScore;
        }
        return team.gameScore + team.totalHandPoints();
    }

    private int sanitizeMatchTargetWins(int matchTargetWins) {
        return switch (matchTargetWins) {
            case 1, 3, 5 -> matchTargetWins;
            default -> DEFAULT_MATCH_TARGET_WINS;
        };
    }

    private Suit toSuit(TrumpChoice choice) {
        return switch (choice) {
            case SPADES -> Suit.SPADES;
            case HEARTS -> Suit.HEARTS;
            case DIAMONDS -> Suit.DIAMONDS;
            case CLUBS -> Suit.CLUBS;
            case SKIP -> throw new IllegalStateException("Skip does not map to a suit.");
        };
    }

    enum Phase {
        READY_TO_START,
        BETWEEN_GAMES,
        TRUMP_SELECTION,
        TRICK_PLAY,
        MATCH_COMPLETE
    }

    enum TeamSide {
        YOURS,
        ENEMIES
    }

    enum Seat {
        SOUTH,
        WEST,
        NORTH,
        EAST
    }

    enum Suit {
        SPADES("Spades", "S"),
        HEARTS("Hearts", "H"),
        DIAMONDS("Diamonds", "D"),
        CLUBS("Clubs", "C");

        final String displayName;
        final String symbol;

        Suit(String displayName, String symbol) {
            this.displayName = displayName;
            this.symbol = symbol;
        }
    }

    enum Rank {
        SEVEN("7"),
        EIGHT("8"),
        NINE("9"),
        TEN("10"),
        JACK("J"),
        QUEEN("Q"),
        KING("K"),
        ACE("A");

        final String symbol;

        Rank(String symbol) {
            this.symbol = symbol;
        }
    }

    record Card(Suit suit, Rank rank) {
        String label() {
            return rank.symbol + suit.symbol;
        }

        int points(Suit trumpSuit) {
            boolean trump = suit == trumpSuit;
            return switch (rank) {
                case SEVEN, EIGHT -> 0;
                case NINE -> trump ? 14 : 0;
                case JACK -> trump ? 20 : 2;
                case QUEEN -> 3;
                case KING -> 4;
                case TEN -> 10;
                case ACE -> 11;
            };
        }

        int strength(Suit leadSuit, Suit trumpSuit) {
            // Trump and plain-card ranges must never overlap.
            if (suit == trumpSuit) {
                return 100 + switch (rank) {
                    case JACK -> 80;
                    case NINE -> 70;
                    case ACE -> 60;
                    case TEN -> 50;
                    case KING -> 40;
                    case QUEEN -> 30;
                    case EIGHT -> 20;
                    case SEVEN -> 10;
                };
            }

            if (suit == leadSuit) {
                return switch (rank) {
                    case ACE -> 60;
                    case TEN -> 50;
                    case KING -> 40;
                    case QUEEN -> 30;
                    case JACK -> 20;
                    case NINE -> 15;
                    case EIGHT -> 10;
                    case SEVEN -> 5;
                };
            }

            return 0;
        }

        int trumpSelectionScore(Suit candidateTrump) {
            // Preserve bidding weights when changing the trick comparison tier.
            int strength = strength(candidateTrump, candidateTrump) - (suit == candidateTrump ? 100 : 0);
            int base = points(candidateTrump) + strength;
            if (suit == candidateTrump && rank == Rank.JACK) {
                return base + 30;
            }
            if (suit == candidateTrump && rank == Rank.NINE) {
                return base + 20;
            }
            if (suit != candidateTrump && rank == Rank.ACE) {
                return base + 8;
            }
            return base;
        }
    }

    record PlayedCard(int playerIndex, Card card) {
    }

    static final class TeamState {
        final TeamSide side;
        String name;
        int matchWins;
        int gameScore;
        int trickPoints;
        int tricksWon;
        int meldPoints;

        TeamState(TeamSide side, String name) {
            this.side = side;
            this.name = name;
        }

        void resetHandState() {
            trickPoints = 0;
            tricksWon = 0;
            meldPoints = 0;
        }

        int totalHandPoints() {
            return tricksWon == 0 ? 0 : trickPoints + meldPoints;
        }
    }

    static final class PlayerState {
        final int index;
        final String id;
        String name;
        final Seat seat;
        boolean human;
        final TeamState team;
        final List<Card> hand = new ArrayList<>();
        boolean belaCalled;
        boolean belaResolved;

        PlayerState(int index, String id, String name, Seat seat, boolean human, TeamState team) {
            this.index = index;
            this.id = id;
            this.name = name;
            this.seat = seat;
            this.human = human;
            this.team = team;
        }
    }

    static final class TrickState {
        final int leadPlayerIndex;
        final List<PlayedCard> cards = new ArrayList<>();

        TrickState(int leadPlayerIndex) {
            this.leadPlayerIndex = leadPlayerIndex;
        }

        Suit leadSuit() {
            return cards.isEmpty() ? null : cards.get(0).card.suit;
        }
    }

    static final class MatchState {
        Difficulty difficulty;
        final List<PlayerState> players;
        final TeamState teamOne;
        final TeamState teamTwo;
        int dealerIndex;
        int currentPlayerIndex;
        int trumpTurnOffset;
        int gameNumber;
        int matchTargetWins;
        int gameTargetPoints;
        List<Card> deck = new ArrayList<>();
        Suit trumpSuit;
        TeamSide declarer;
        Integer declarerPlayerIndex;
        TrickState currentTrick;
        List<MeldSet> lastWinningMeldSets = List.of();
        List<MeldSet> declaredMeldSets = new ArrayList<>();
        MeldSet humanMeldOffer;
        final List<MeldSet> pendingHumanMeldOffers = new ArrayList<>();
        MeldWinnerView pendingMeldWinner;
        boolean firstTrickAnnounced;
        Phase phase;
        ActionType pendingType;
        String pendingValidationMessage;
        String pendingValidationCode;

        MatchState(Difficulty difficulty, List<PlayerState> players, TeamState teamOne, TeamState teamTwo) {
            this.difficulty = difficulty;
            this.players = players;
            this.teamOne = teamOne;
            this.teamTwo = teamTwo;
            this.dealerIndex = 3;
            this.phase = Phase.READY_TO_START;
            this.pendingType = ActionType.START_MATCH;
            this.matchTargetWins = DEFAULT_MATCH_TARGET_WINS;
            this.gameTargetPoints = GameLength.LONG.targetPoints();
        }

        static MatchState create(Difficulty difficulty) {
            TeamState yourTeam = new TeamState(TeamSide.YOURS, "Us");
            TeamState enemyTeam = new TeamState(TeamSide.ENEMIES, "Them");
            List<PlayerState> players = List.of(
                    new PlayerState(0, "south", "You", Seat.SOUTH, true, yourTeam),
                    new PlayerState(1, "west", "Zapad", Seat.WEST, false, enemyTeam),
                    new PlayerState(2, "north", "Ti", Seat.NORTH, false, yourTeam),
                    new PlayerState(3, "east", "Istok", Seat.EAST, false, enemyTeam)
            );
            return new MatchState(difficulty, players, yourTeam, enemyTeam);
        }
    }

    record MeldCombination(String kind, String label, int points, int comparisonValue, List<Card> cards) {
    }

    record MeldSet(PlayerState player, List<MeldCombination> melds, int totalPoints, int strongestComparisonValue) {
    }

    record MeldWinner(TeamSide team, String teamName, List<MeldSet> players, int totalPoints) {
    }
}
