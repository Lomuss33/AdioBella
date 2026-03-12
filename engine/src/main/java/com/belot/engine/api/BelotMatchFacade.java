package com.belot.engine.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

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
        log("INFO", "New Belot session created.", Map.of("difficulty", difficulty.name()));
    }

    public synchronized void startMatch() {
        ensure(state.phase == Phase.READY_TO_START || state.phase == Phase.BETWEEN_GAMES, "The match is already running.");
        clearValidation();
        if (state.phase == Phase.READY_TO_START) {
            startNextGame(false);
        } else {
            startNextFullGame(true);
        }
        processUntilHumanTurn();
    }

    public synchronized void updatePlayerNames(Map<String, String> playerNamesBySeat) {
        ensure(state.phase == Phase.READY_TO_START, "Player names can only be changed before the match starts.");
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

        log("INFO", "Player names updated.", Map.of());
    }

    public synchronized void updateTeamNames(String yourTeamName, String enemyTeamName) {
        ensure(state.phase == Phase.READY_TO_START, "Team names can only be changed before the match starts.");

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
            log("INFO", "Team names updated.", Map.of());
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
        ensure(state.phase == Phase.READY_TO_START, "Lobby settings can only be changed before the match starts.");
        if (difficulty != null) {
            state.difficulty = difficulty;
        }
        updateGameSettings(matchTargetWins, gameLength);
        updateTeamNames(yourTeamName, enemyTeamName);
        updatePlayerNames(playerNamesBySeat);
    }

    public synchronized void updateGameSettings(Integer matchTargetWins, GameLength gameLength) {
        ensure(state.phase == Phase.READY_TO_START, "Game settings can only be changed before the match starts.");

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
            reject("Choose a trump suit or skip.");
        }

        if (choice == TrumpChoice.SKIP && state.trumpTurnOffset == 3) {
            reject("The last player must choose a trump suit.");
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
            reject("That card is not legal in the current trick.");
        }

        playCardInternal(handIndex, callBela);
        processUntilHumanTurn();
    }

    public synchronized void reportMelds(boolean declare) {
        ensurePending(ActionType.REPORT_MELDS);
        clearValidation();

        if (state.humanMeldOffer == null || state.humanMeldOffer.totalPoints() == 0) {
            reject("There are no melds to report.");
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
        PendingAction pendingAction = buildPendingAction();
        List<Integer> legalCardIndices = pendingAction.type() == ActionType.PLAY_CARD
                ? pendingAction.legalCardIndices()
                : List.of();

        List<PlayerView> players = state.players.stream()
                .map(player -> toPlayerView(player, legalCardIndices))
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
                visibleMeldSets().stream()
                        .map(this::toMeldDeclarationView)
                        .toList()
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

                TrumpChoice choice = chooseTrumpForAi(player, state.trumpTurnOffset == 3);
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

            int chosenIndex = chooseCardForAi(player, legal);
            playCardInternal(chosenIndex, belaEligibleCardIndices(player).contains(chosenIndex));
        }
    }

    private void playCardInternal(int handIndex, boolean callBela) {
        PlayerState player = currentPlayer();
        boolean belaEligible = isBelaEligible(player, handIndex);
        if (callBela && !belaEligible) {
            reject("Bela cannot be called with that card.");
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
        PlayedCard winningPlay = RuleUtils.findWinningPlay(state.currentTrick.cards, state.trumpSuit);
        PlayerState winner = playerAt(winningPlay.playerIndex);
        int trickPoints = state.currentTrick.cards.stream().mapToInt(play -> play.card.points(state.trumpSuit)).sum();
        winner.team.trickPoints += trickPoints;

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
                "team", winner.team.name
                ,
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

        if (declarer.totalHandPoints() > defenders.totalHandPoints()) {
            state.teamOne.gameScore += teamOnePoints;
            state.teamTwo.gameScore += teamTwoPoints;
            log("SCORE", declarer.name + " passed the hand.", Map.of(
                    "teamOnePoints", String.valueOf(teamOnePoints),
                    "teamTwoPoints", String.valueOf(teamTwoPoints)
            ));
        } else {
            defenders.gameScore += totalPoints;
            log("SCORE", declarer.name + " failed the hand. " + defenders.name + " collected all " + totalPoints + " points.",
                    Map.of("winner", defenders.name, "points", String.valueOf(totalPoints)));
        }

        TeamState winner = state.teamOne.gameScore >= state.teamTwo.gameScore ? state.teamOne : state.teamTwo;
        if (winner.gameScore >= state.gameTargetPoints) {
            winner.matchWins += 1;
            log("INFO", winner.name + " won the game.", Map.of(
                    "eventKind", "GAME_WIN",
                    "winner", winner.name,
                    "winningScore", String.valueOf(winner.gameScore),
                    "matchWins", String.valueOf(winner.matchWins)
            ));

            if (winner.matchWins >= state.matchTargetWins) {
                state.phase = Phase.MATCH_COMPLETE;
                state.pendingType = ActionType.NONE;
                log("INFO", winner.name + " won the match.", Map.of(
                        "eventKind", "MATCH_WIN",
                        "winner", winner.name,
                        "matchWins", String.valueOf(winner.matchWins)
                ));
                return;
            }

            state.phase = Phase.BETWEEN_GAMES;
            state.pendingType = ActionType.START_NEXT_GAME;
            state.pendingValidationMessage = null;
            state.currentTrick = null;
            return;
        }

        startNextGame(true);
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

        state.phase = Phase.TRUMP_SELECTION;
        state.pendingType = ActionType.NONE;
        state.pendingValidationMessage = null;
        state.trumpSuit = null;
        state.declarer = null;
        state.trumpTurnOffset = 0;
        state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.size();
        state.teamOne.resetHandState();
        state.teamTwo.resetHandState();
        state.currentTrick = null;
        state.lastWinningMeldSets = List.of();
        state.declaredMeldSets = new ArrayList<>();
        state.humanMeldOffer = null;
        state.pendingMeldWinner = null;
        state.firstTrickAnnounced = false;
        state.declarerPlayerIndex = null;

        for (PlayerState player : state.players) {
            player.hand.clear();
            player.belaCalled = false;
            player.belaResolved = false;
        }

        state.deck = RuleUtils.createShuffledDeck(random);
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

    private void applyMelds() {
        state.declaredMeldSets = state.players.stream()
                .map(player -> MeldService.evaluate(player, state.trumpSuit))
                .filter(meldSet -> meldSet.totalPoints() > 0)
                .collect(Collectors.toCollection(ArrayList::new));
        state.humanMeldOffer = null;
        finalizeMeldDeclarations();
    }

    private void setupMeldFlow() {
        state.declaredMeldSets = new ArrayList<>();
        state.lastWinningMeldSets = List.of();
        state.pendingMeldWinner = null;
        state.humanMeldOffer = null;

        for (PlayerState player : state.players) {
            MeldSet meldSet = MeldService.evaluate(player, state.trumpSuit);
            if (meldSet.totalPoints() == 0) {
                continue;
            }

            if (player.human) {
                state.humanMeldOffer = meldSet;
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

        if (state.humanMeldOffer != null) {
            state.pendingType = ActionType.REPORT_MELDS;
            return;
        }

        finalizeMeldDeclarations();
    }

    private void finalizeMeldDeclarations() {
        MeldWinner winner = determineWinningMeldWinner(state.declaredMeldSets);
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

    private MeldWinner determineWinningMeldWinner(List<MeldSet> declaredMeldSets) {
        List<MeldSet> yourSets = declaredMeldSets.stream()
                .filter(meldSet -> meldSet.player().team.side == TeamSide.YOURS)
                .toList();
        List<MeldSet> enemySets = declaredMeldSets.stream()
                .filter(meldSet -> meldSet.player().team.side == TeamSide.ENEMIES)
                .toList();

        int yourHighest = yourSets.stream().mapToInt(MeldSet::strongestComparisonValue).max().orElse(0);
        int enemyHighest = enemySets.stream().mapToInt(MeldSet::strongestComparisonValue).max().orElse(0);
        if (yourHighest == 0 && enemyHighest == 0) {
            return null;
        }

        TeamSide winningTeam;
        if (yourHighest > enemyHighest) {
            winningTeam = TeamSide.YOURS;
        } else if (enemyHighest > yourHighest) {
            winningTeam = TeamSide.ENEMIES;
        } else {
            winningTeam = state.declarer;
        }

        List<MeldSet> winningSets = winningTeam == TeamSide.YOURS ? yourSets : enemySets;
        return new MeldWinner(
                winningTeam,
                teamFor(winningTeam).name,
                winningSets,
                winningSets.stream().mapToInt(MeldSet::totalPoints).sum()
        );
    }

    private List<Integer> belaEligibleCardIndices(PlayerState player) {
        List<Integer> eligible = new ArrayList<>();
        for (int index = 0; index < player.hand.size(); index++) {
            if (isBelaEligible(player, index)) {
                eligible.add(index);
            }
        }
        return eligible;
    }

    private boolean isBelaEligible(PlayerState player, int handIndex) {
        if (player.belaResolved || state.trumpSuit == null || handIndex < 0 || handIndex >= player.hand.size()) {
            return false;
        }

        Card card = player.hand.get(handIndex);
        if (card.suit != state.trumpSuit || (card.rank != Rank.QUEEN && card.rank != Rank.KING)) {
            return false;
        }

        Rank partnerRank = card.rank == Rank.QUEEN ? Rank.KING : Rank.QUEEN;
        for (int index = 0; index < player.hand.size(); index++) {
            if (index == handIndex) {
                continue;
            }
            Card candidate = player.hand.get(index);
            if (candidate.suit == state.trumpSuit && candidate.rank == partnerRank) {
                return true;
            }
        }
        return false;
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
        return RuleUtils.legalCardIndices(player.hand, state.currentTrick.cards, state.trumpSuit, player.team.side);
    }

    private int chooseCardForAi(PlayerState player, List<Integer> legalIndices) {
        return switch (state.difficulty) {
            case EASY -> legalIndices.get(random.nextInt(legalIndices.size()));
            case NORMAL -> chooseNormalCard(player, legalIndices);
            case HARD -> chooseHardCard(player, legalIndices);
        };
    }

    private int chooseNormalCard(PlayerState player, List<Integer> legalIndices) {
        PlayedCard currentWinner = RuleUtils.findWinningPlay(state.currentTrick.cards, state.trumpSuit);
        return legalIndices.stream()
                .min(Comparator.comparingInt(index -> {
                    Card card = player.hand.get(index);
                    boolean wins = currentWinner == null
                            || RuleUtils.cardWins(card, currentWinner.card, state.currentTrick.leadSuit(), state.trumpSuit);
                    return wins ? card.points(state.trumpSuit) : 100 + card.points(state.trumpSuit);
                }))
                .orElse(legalIndices.get(0));
    }

    private int chooseHardCard(PlayerState player, List<Integer> legalIndices) {
        PlayedCard currentWinner = RuleUtils.findWinningPlay(state.currentTrick.cards, state.trumpSuit);
        List<Integer> winningCards = legalIndices.stream()
                .filter(index -> currentWinner == null
                        || RuleUtils.cardWins(player.hand.get(index), currentWinner.card, state.currentTrick.leadSuit(), state.trumpSuit))
                .toList();

        if (!winningCards.isEmpty()) {
            return winningCards.stream()
                    .min(Comparator.comparingInt(index -> player.hand.get(index).strength(state.currentTrick.leadSuit(), state.trumpSuit)))
                    .orElse(winningCards.get(0));
        }

        return legalIndices.stream()
                .min(Comparator.comparingInt(index -> player.hand.get(index).points(state.trumpSuit)))
                .orElse(legalIndices.get(0));
    }

    private TrumpChoice chooseTrumpForAi(PlayerState player, boolean forced) {
        TrumpChoice bestChoice = TrumpChoice.SKIP;
        int bestScore = Integer.MIN_VALUE;

        for (Suit suit : Suit.values()) {
            int score = player.hand.stream().mapToInt(card -> card.trumpSelectionScore(suit)).sum();
            if (score > bestScore) {
                bestScore = score;
                bestChoice = TrumpChoice.valueOf(suit.name());
            }
        }

        int threshold = switch (state.difficulty) {
            case EASY -> 42;
            case NORMAL -> 36;
            case HARD -> 32;
        };

        return forced || bestScore >= threshold ? bestChoice : TrumpChoice.SKIP;
    }

    private PendingAction buildPendingAction() {
        return switch (state.pendingType) {
            case START_MATCH -> new PendingAction(ActionType.START_MATCH, playerAt(0).id, List.of(), List.of(), List.of(), List.of(), null, state.pendingValidationMessage, "Start the match.");
            case START_NEXT_GAME -> new PendingAction(ActionType.START_NEXT_GAME, playerAt(0).id, List.of(), List.of(), List.of(), List.of(), null, state.pendingValidationMessage, "Start the next game.");
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
                    state.trumpTurnOffset == 3 ? "Choose the trump suit." : "Choose the trump suit or skip."
            );
            case REPORT_MELDS -> new PendingAction(
                    ActionType.REPORT_MELDS,
                    currentPlayer().id,
                    List.of(),
                    List.of(),
                    List.of(),
                    state.humanMeldOffer == null ? List.of() : List.of(toMeldSetView(state.humanMeldOffer)),
                    null,
                    state.pendingValidationMessage,
                    "Declare melds or pass."
            );
            case ACKNOWLEDGE_MELDS -> new PendingAction(
                    ActionType.ACKNOWLEDGE_MELDS,
                    currentPlayer().id,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    state.pendingMeldWinner,
                    state.pendingValidationMessage,
                    "Review the melds and continue."
            );
            case PLAY_CARD -> new PendingAction(
                    ActionType.PLAY_CARD,
                    currentPlayer().id,
                    legalCardIndices(currentPlayer()),
                    List.of(),
                    belaEligibleCardIndices(currentPlayer()),
                    List.of(),
                    null,
                    state.pendingValidationMessage,
                    "Play a legal card."
            );
            case NONE -> new PendingAction(ActionType.NONE, null, List.of(), List.of(), List.of(), List.of(), null, state.pendingValidationMessage, "");
        };
    }

    private PlayerView toPlayerView(PlayerState player, List<Integer> legalCardIndices) {
        List<CardView> hand = new ArrayList<>();
        if (player.human) {
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

    private MeldDeclarationView toMeldDeclarationView(MeldSet meldSet) {
        return new MeldDeclarationView(
                meldSet.player().id,
                meldSet.player().name,
                meldSet.player().team.name,
                meldSet.totalPoints(),
                0,
                meldSet.melds().stream().map(MeldCombination::label).toList()
        );
    }

    private List<MeldSet> visibleMeldSets() {
        return state.lastWinningMeldSets;
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
        ensure(state.pendingType == expected, "That action is not expected right now.");
    }

    private void ensure(boolean condition, String message) {
        if (!condition) {
            reject(message);
        }
    }

    private void reject(String message) {
        state.pendingValidationMessage = message;
        log("ERROR", message, Map.of());
        throw new IllegalArgumentException(message);
    }

    private void clearValidation() {
        state.pendingValidationMessage = null;
    }

    private void log(String type, String message, Map<String, String> payload) {
        events.add(new GameEvent(nextSequence++, type, message, Instant.now(), payload));
    }

    private PlayerState currentPlayer() {
        return playerAt(state.currentPlayerIndex);
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

    private enum Phase {
        READY_TO_START,
        BETWEEN_GAMES,
        TRUMP_SELECTION,
        TRICK_PLAY,
        MATCH_COMPLETE
    }

    private enum TeamSide {
        YOURS,
        ENEMIES
    }

    private enum Seat {
        SOUTH,
        WEST,
        NORTH,
        EAST
    }

    private enum Suit {
        SPADES("Spades", "S"),
        HEARTS("Hearts", "H"),
        DIAMONDS("Diamonds", "D"),
        CLUBS("Clubs", "C");

        private final String displayName;
        private final String symbol;

        Suit(String displayName, String symbol) {
            this.displayName = displayName;
            this.symbol = symbol;
        }
    }

    private enum Rank {
        SEVEN("7"),
        EIGHT("8"),
        NINE("9"),
        TEN("10"),
        JACK("J"),
        QUEEN("Q"),
        KING("K"),
        ACE("A");

        private final String symbol;

        Rank(String symbol) {
            this.symbol = symbol;
        }
    }

    private record Card(Suit suit, Rank rank) {
        private String label() {
            return rank.symbol + suit.symbol;
        }

        private int points(Suit trumpSuit) {
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

        private int strength(Suit leadSuit, Suit trumpSuit) {
            if (suit == trumpSuit) {
                return switch (rank) {
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

        private int trumpSelectionScore(Suit candidateTrump) {
            int base = points(candidateTrump) + strength(candidateTrump, candidateTrump);
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

    private record PlayedCard(int playerIndex, Card card) {
    }

    private static final class TeamState {
        private final TeamSide side;
        private String name;
        private int matchWins;
        private int gameScore;
        private int trickPoints;
        private int meldPoints;

        private TeamState(TeamSide side, String name) {
            this.side = side;
            this.name = name;
        }

        private void resetHandState() {
            trickPoints = 0;
            meldPoints = 0;
        }

        private int totalHandPoints() {
            return trickPoints == 0 ? 0 : trickPoints + meldPoints;
        }
    }

    private static final class PlayerState {
        private final int index;
        private final String id;
        private String name;
        private final Seat seat;
        private final boolean human;
        private final TeamState team;
        private final List<Card> hand = new ArrayList<>();
        private boolean belaCalled;
        private boolean belaResolved;

        private PlayerState(int index, String id, String name, Seat seat, boolean human, TeamState team) {
            this.index = index;
            this.id = id;
            this.name = name;
            this.seat = seat;
            this.human = human;
            this.team = team;
        }
    }

    private static final class TrickState {
        private final int leadPlayerIndex;
        private final List<PlayedCard> cards = new ArrayList<>();

        private TrickState(int leadPlayerIndex) {
            this.leadPlayerIndex = leadPlayerIndex;
        }

        private Suit leadSuit() {
            return cards.isEmpty() ? null : cards.get(0).card.suit;
        }
    }

    private static final class MatchState {
        private Difficulty difficulty;
        private final List<PlayerState> players;
        private final TeamState teamOne;
        private final TeamState teamTwo;
        private int dealerIndex;
        private int currentPlayerIndex;
        private int trumpTurnOffset;
        private int gameNumber;
        private int matchTargetWins;
        private int gameTargetPoints;
        private List<Card> deck = new ArrayList<>();
        private Suit trumpSuit;
        private TeamSide declarer;
        private Integer declarerPlayerIndex;
        private TrickState currentTrick;
        private List<MeldSet> lastWinningMeldSets = List.of();
        private List<MeldSet> declaredMeldSets = new ArrayList<>();
        private MeldSet humanMeldOffer;
        private MeldWinnerView pendingMeldWinner;
        private boolean firstTrickAnnounced;
        private Phase phase;
        private ActionType pendingType;
        private String pendingValidationMessage;

        private MatchState(Difficulty difficulty, List<PlayerState> players, TeamState teamOne, TeamState teamTwo) {
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

        private static MatchState create(Difficulty difficulty) {
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

    private record MeldCombination(String kind, String label, int points, int comparisonValue, List<Card> cards) {
    }

    private record MeldSet(PlayerState player, List<MeldCombination> melds, int totalPoints, int strongestComparisonValue) {
    }

    private record MeldWinner(TeamSide team, String teamName, List<MeldSet> players, int totalPoints) {
    }

    private static final class MeldService {
        private static MeldSet evaluate(PlayerState player, Suit trumpSuit) {
            List<MeldCombination> candidates = new ArrayList<>();
            candidates.addAll(fourOfKindCandidates(player.hand));
            candidates.addAll(sequenceCandidates(player.hand));

            BestSelection bestSelection = chooseBestNonOverlapping(candidates, 0, new HashSet<>(), new ArrayList<>(), 0, 0, null);
            return new MeldSet(player, List.copyOf(bestSelection.melds()), bestSelection.totalPoints(), bestSelection.strongestComparisonValue());
        }

        private static List<MeldCombination> fourOfKindCandidates(List<Card> hand) {
            List<MeldCombination> combinations = new ArrayList<>();
            Map<Rank, List<Card>> byRank = hand.stream().collect(Collectors.groupingBy(card -> card.rank));
            for (Map.Entry<Rank, List<Card>> entry : byRank.entrySet()) {
                Rank rank = entry.getKey();
                if (entry.getValue().size() != 4 || rank == Rank.SEVEN || rank == Rank.EIGHT) {
                    continue;
                }

                int points = rank == Rank.JACK ? 200 : rank == Rank.NINE ? 150 : 100;
                int comparisonValue = rank == Rank.JACK ? 700 + rank.ordinal() : rank == Rank.NINE ? 650 + rank.ordinal() : 600 + rank.ordinal();
                String label = rank == Rank.JACK ? "Four Jacks" : rank == Rank.NINE ? "Four Nines" : "Four of a Kind";
                combinations.add(new MeldCombination("FOUR_OF_A_KIND", label, points, comparisonValue, List.copyOf(entry.getValue())));
            }
            return combinations;
        }

        private static List<MeldCombination> sequenceCandidates(List<Card> hand) {
            List<MeldCombination> combinations = new ArrayList<>();
            Map<Suit, List<Card>> bySuit = hand.stream().collect(Collectors.groupingBy(card -> card.suit));
            for (Map.Entry<Suit, List<Card>> entry : bySuit.entrySet()) {
                List<Card> cards = new ArrayList<>(entry.getValue());
                cards.sort(Comparator.comparingInt(card -> card.rank.ordinal()));

                for (int start = 0; start < cards.size(); start++) {
                    List<Card> run = new ArrayList<>();
                    run.add(cards.get(start));
                    for (int index = start + 1; index < cards.size(); index++) {
                        Card previous = cards.get(index - 1);
                        Card current = cards.get(index);
                        if (current.rank.ordinal() != previous.rank.ordinal() + 1) {
                            break;
                        }
                        run.add(current);
                        if (run.size() >= 3) {
                            combinations.add(sequenceCombination(run));
                        }
                    }
                }
            }
            return combinations;
        }

        private static MeldCombination sequenceCombination(List<Card> run) {
            Card highest = run.get(run.size() - 1);
            int points = run.size() >= 5 ? 100 : run.size() == 4 ? 50 : 20;
            int comparisonValue = run.size() >= 5 ? 500 + highest.rank.ordinal() : run.size() == 4 ? 450 + highest.rank.ordinal() : 400 + highest.rank.ordinal();
            String label = "Sequence of " + run.size();
            return new MeldCombination("SEQUENCE", label, points, comparisonValue, List.copyOf(run));
        }

        private static BestSelection chooseBestNonOverlapping(
                List<MeldCombination> candidates,
                int index,
                Set<String> usedCards,
                List<MeldCombination> chosen,
                int totalPoints,
                int strongestComparisonValue,
                BestSelection best
        ) {
            BestSelection currentBest = best;
            if (index >= candidates.size()) {
                BestSelection candidate = new BestSelection(List.copyOf(chosen), totalPoints, strongestComparisonValue);
                if (currentBest == null || candidate.beats(currentBest)) {
                    return candidate;
                }
                return currentBest;
            }

            currentBest = chooseBestNonOverlapping(candidates, index + 1, usedCards, chosen, totalPoints, strongestComparisonValue, currentBest);
            MeldCombination combination = candidates.get(index);
            if (combination.cards().stream().map(MeldService::cardKey).noneMatch(usedCards::contains)) {
                List<String> addedKeys = combination.cards().stream().map(MeldService::cardKey).toList();
                usedCards.addAll(addedKeys);
                chosen.add(combination);
                currentBest = chooseBestNonOverlapping(
                        candidates,
                        index + 1,
                        usedCards,
                        chosen,
                        totalPoints + combination.points(),
                        Math.max(strongestComparisonValue, combination.comparisonValue()),
                        currentBest
                );
                chosen.remove(chosen.size() - 1);
                usedCards.removeAll(addedKeys);
            }
            return currentBest;
        }

        private static String cardKey(Card card) {
            return card.suit.name() + ":" + card.rank.name();
        }

        private record BestSelection(List<MeldCombination> melds, int totalPoints, int strongestComparisonValue) {
            private boolean beats(BestSelection other) {
                if (totalPoints != other.totalPoints()) {
                    return totalPoints > other.totalPoints();
                }
                if (strongestComparisonValue != other.strongestComparisonValue()) {
                    return strongestComparisonValue > other.strongestComparisonValue();
                }
                return melds.size() < other.melds.size();
            }
        }
    }

    private static final class RuleUtils {
        private static List<Card> createShuffledDeck(Random random) {
            List<Card> deck = new ArrayList<>();
            for (Suit suit : Suit.values()) {
                for (Rank rank : Rank.values()) {
                    deck.add(new Card(suit, rank));
                }
            }
            Collections.shuffle(deck, random);
            return deck;
        }

        private static List<Integer> legalCardIndices(List<Card> hand, List<PlayedCard> trick, Suit trumpSuit, TeamSide teamSide) {
            if (trick.isEmpty()) {
                return indexRange(hand.size());
            }

            Suit leadSuit = trick.get(0).card.suit;
            List<Integer> leadSuitCards = indexesForSuit(hand, leadSuit);
            if (!leadSuitCards.isEmpty()) {
                if (leadSuit == trumpSuit) {
                    List<Integer> overTrump = higherTrumpCards(hand, trick, trumpSuit);
                    return overTrump.isEmpty() ? leadSuitCards : overTrump;
                }
                return leadSuitCards;
            }

            PlayedCard currentWinner = findWinningPlay(trick, trumpSuit);
            boolean partnerWinning = currentWinner != null && teamSide == teamSideForPlayer(currentWinner.playerIndex);
            List<Integer> trumpCards = indexesForSuit(hand, trumpSuit);
            if (partnerWinning || trumpCards.isEmpty()) {
                return indexRange(hand.size());
            }

            List<Integer> overTrump = higherTrumpCards(hand, trick, trumpSuit);
            return overTrump.isEmpty() ? trumpCards : overTrump;
        }

        private static PlayedCard findWinningPlay(List<PlayedCard> trick, Suit trumpSuit) {
            if (trick.isEmpty()) {
                return null;
            }
            Suit leadSuit = trick.get(0).card.suit;
            return trick.stream()
                    .max(Comparator.comparingInt(play -> play.card.strength(leadSuit, trumpSuit)))
                    .orElse(trick.get(0));
        }

        private static boolean cardWins(Card challenger, Card currentWinner, Suit leadSuit, Suit trumpSuit) {
            return challenger.strength(leadSuit, trumpSuit) > currentWinner.strength(leadSuit, trumpSuit);
        }

        private static List<Integer> higherTrumpCards(List<Card> hand, List<PlayedCard> trick, Suit trumpSuit) {
            PlayedCard currentWinner = findWinningPlay(trick, trumpSuit);
            if (currentWinner == null || currentWinner.card.suit != trumpSuit) {
                return indexesForSuit(hand, trumpSuit);
            }

            return indexRange(hand.size()).stream()
                    .filter(index -> hand.get(index).suit == trumpSuit)
                    .filter(index -> hand.get(index).strength(trumpSuit, trumpSuit)
                            > currentWinner.card.strength(trumpSuit, trumpSuit))
                    .toList();
        }

        private static List<Integer> indexesForSuit(List<Card> hand, Suit suit) {
            List<Integer> indexes = new ArrayList<>();
            for (int index = 0; index < hand.size(); index++) {
                if (hand.get(index).suit == suit) {
                    indexes.add(index);
                }
            }
            return indexes;
        }

        private static List<Integer> indexRange(int size) {
            List<Integer> indexes = new ArrayList<>(size);
            for (int index = 0; index < size; index++) {
                indexes.add(index);
            }
            return indexes;
        }

        private static TeamSide teamSideForPlayer(int playerIndex) {
            return playerIndex % 2 == 0 ? TeamSide.YOURS : TeamSide.ENEMIES;
        }
    }


}
