package com.belot.engine.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.stream.Collectors;

public final class BelotMatchFacade {

    private static final int GAME_WIN_SCORE = 1001;
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
        ensure(state.phase == Phase.READY_TO_START, "The match is already running.");
        clearValidation();
        startNextGame(false);
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

    public synchronized void updateLobbySettings(Difficulty difficulty, Map<String, String> playerNamesBySeat, String yourTeamName, String enemyTeamName) {
        ensure(state.phase == Phase.READY_TO_START, "Lobby settings can only be changed before the match starts.");
        if (difficulty != null) {
            state.difficulty = difficulty;
        }
        updateTeamNames(yourTeamName, enemyTeamName);
        updatePlayerNames(playerNamesBySeat);
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
        ensurePending(ActionType.PLAY_CARD);
        clearValidation();

        List<Integer> legal = legalCardIndices(currentPlayer());
        if (!legal.contains(handIndex)) {
            reject("That card is not legal in the current trick.");
        }

        playCardInternal(handIndex);
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
                state.teamOne.gameScore,
                state.teamTwo.name,
                state.teamTwo.matchWins,
                state.teamTwo.gameScore,
                state.declarer == null ? null : teamFor(state.declarer).name,
                state.gameNumber,
                state.difficulty.name(),
                state.teamOne.meldPoints,
                state.teamTwo.meldPoints,
                state.lastMeldAwards.stream()
                        .filter(award -> award.meldPoints > 0 || award.belaPoints > 0)
                        .map(this::toMeldDeclarationView)
                        .toList()
        );

        return new GameSnapshot(
                state.phase.name(),
                state.trumpSuit == null ? null : state.trumpSuit.name(),
                playerAt(state.dealerIndex).id,
                state.declarerPlayerIndex == null ? null : playerAt(state.declarerPlayerIndex).id,
                state.phase == Phase.READY_TO_START || state.phase == Phase.MATCH_COMPLETE ? null : currentPlayer().id,
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
            if (state.phase == Phase.MATCH_COMPLETE || state.phase == Phase.READY_TO_START) {
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
            playCardInternal(chosenIndex);
        }
    }

    private void playCardInternal(int handIndex) {
        PlayerState player = currentPlayer();
        Card card = player.hand.remove(handIndex);
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
        if (winner.gameScore >= GAME_WIN_SCORE) {
            state.phase = Phase.MATCH_COMPLETE;
            state.pendingType = ActionType.NONE;
            winner.matchWins += 1;
            log("INFO", winner.name + " won the game.", Map.of(
                    "winner", winner.name,
                    "winningScore", String.valueOf(winner.gameScore),
                    "matchWins", String.valueOf(winner.matchWins)
            ));
            return;
        }

        startNextGame(true);
    }

    private void startNextGame(boolean rotateDealer) {
        if (rotateDealer) {
            state.dealerIndex = (state.dealerIndex + 1) % state.players.size();
        }

        state.gameNumber++;
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
        state.lastMeldAwards = List.of();
        state.declarerPlayerIndex = null;

        for (PlayerState player : state.players) {
            player.hand.clear();
        }

        state.deck = RuleUtils.createShuffledDeck(random);
        dealCards(OPENING_DEAL_SIZE);

        log("INFO", "Game " + state.gameNumber + " started. " + playerAt(state.dealerIndex).name + " is the dealer.",
                Map.of("dealerPlayerId", playerAt(state.dealerIndex).id));
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
        applyMelds();
        log("INFO", playerAt(state.currentPlayerIndex).name + " leads the first trick.", Map.of("playerId", playerAt(state.currentPlayerIndex).id));
    }

    private void applyMelds() {
        List<MeldAward> awards = state.players.stream().map(player -> MeldService.evaluate(player, state.trumpSuit)).toList();
        state.lastMeldAwards = awards;

        for (MeldAward award : awards) {
            if (award.belaPoints > 0) {
                teamFor(award.player.team.side).meldPoints += award.belaPoints;
                log("INFO", award.player.name + " declared Bela for 20 points.", Map.of("playerId", award.player.id));
            }
        }

        MeldAward winningAward = awards.stream()
                .filter(award -> award.comparisonValue > 0)
                .max(Comparator.comparingInt((MeldAward award) -> award.comparisonValue)
                        .thenComparingInt(award -> 10 - award.player.index))
                .orElse(null);

        if (winningAward == null) {
            return;
        }

        TeamSide winningTeam = winningAward.player.team.side;
        int points = awards.stream()
                .filter(award -> award.player.team.side == winningTeam)
                .mapToInt(award -> award.meldPoints)
                .sum();
        if (points == 0) {
            return;
        }

        teamFor(winningTeam).meldPoints += points;

        String labels = awards.stream()
                .filter(award -> award.player.team.side == winningTeam)
                .flatMap(award -> award.labels.stream())
                .collect(Collectors.joining(", "));

        log("INFO", teamFor(winningTeam).name + " won meld points: " + labels + ".",
                Map.of("team", teamFor(winningTeam).name, "points", String.valueOf(points)));
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
            case START_MATCH -> new PendingAction(ActionType.START_MATCH, playerAt(0).id, List.of(), List.of(), state.pendingValidationMessage, "Start the match.");
            case CHOOSE_TRUMP -> new PendingAction(
                    ActionType.CHOOSE_TRUMP,
                    currentPlayer().id,
                    List.of(),
                    state.trumpTurnOffset == 3
                            ? List.of("SPADES", "HEARTS", "DIAMONDS", "CLUBS")
                            : List.of("SKIP", "SPADES", "HEARTS", "DIAMONDS", "CLUBS"),
                    state.pendingValidationMessage,
                    state.trumpTurnOffset == 3 ? "Choose the trump suit." : "Choose the trump suit or skip."
            );
            case PLAY_CARD -> new PendingAction(
                    ActionType.PLAY_CARD,
                    currentPlayer().id,
                    legalCardIndices(currentPlayer()),
                    List.of(),
                    state.pendingValidationMessage,
                    "Play a legal card."
            );
            case NONE -> new PendingAction(ActionType.NONE, null, List.of(), List.of(), state.pendingValidationMessage, "");
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
                player.team.gameScore,
                player.index == state.dealerIndex,
                state.phase != Phase.READY_TO_START && state.phase != Phase.MATCH_COMPLETE && player.index == state.currentPlayerIndex
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

    private MeldDeclarationView toMeldDeclarationView(MeldAward award) {
        return new MeldDeclarationView(
                award.player.id,
                award.player.name,
                award.player.team.name,
                award.meldPoints,
                award.belaPoints,
                List.copyOf(award.labels)
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
            return trickPoints + meldPoints;
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
        private List<Card> deck = new ArrayList<>();
        private Suit trumpSuit;
        private TeamSide declarer;
        private Integer declarerPlayerIndex;
        private TrickState currentTrick;
        private List<MeldAward> lastMeldAwards = List.of();
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

    private record MeldAward(PlayerState player, int meldPoints, int belaPoints, int comparisonValue, List<String> labels) {
    }

    private static final class MeldService {
        private static MeldAward evaluate(PlayerState player, Suit trumpSuit) {
            List<String> labels = new ArrayList<>();
            int meldPoints = 0;
            int belaPoints = hasBela(player.hand, trumpSuit) ? 20 : 0;
            int comparisonValue = 0;

            Map<Rank, List<Card>> byRank = player.hand.stream().collect(Collectors.groupingBy(card -> card.rank));
            for (Map.Entry<Rank, List<Card>> entry : byRank.entrySet()) {
                if (entry.getValue().size() != 4 || entry.getKey() == Rank.SEVEN || entry.getKey() == Rank.EIGHT) {
                    continue;
                }

                Rank rank = entry.getKey();
                if (rank == Rank.JACK) {
                    meldPoints += 200;
                    comparisonValue = Math.max(comparisonValue, 700);
                    labels.add("Four Jacks");
                } else if (rank == Rank.NINE) {
                    meldPoints += 150;
                    comparisonValue = Math.max(comparisonValue, 650);
                    labels.add("Four Nines");
                } else {
                    meldPoints += 100;
                    comparisonValue = Math.max(comparisonValue, 600);
                    labels.add("Four of a Kind");
                }
            }

            Map<Suit, List<Card>> bySuit = player.hand.stream().collect(Collectors.groupingBy(card -> card.suit));
            for (Map.Entry<Suit, List<Card>> entry : bySuit.entrySet()) {
                List<Card> cards = new ArrayList<>(entry.getValue());
                cards.sort(Comparator.comparingInt(card -> card.rank.ordinal()));

                int runLength = 1;
                for (int index = 1; index <= cards.size(); index++) {
                    boolean contiguous = index < cards.size()
                            && cards.get(index).rank.ordinal() == cards.get(index - 1).rank.ordinal() + 1;
                    if (contiguous) {
                        runLength++;
                        continue;
                    }

                    if (runLength >= 3) {
                        if (runLength >= 5) {
                            meldPoints += 100;
                            comparisonValue = Math.max(comparisonValue, 500 + runLength);
                            labels.add("Sequence of " + runLength);
                        } else if (runLength == 4) {
                            meldPoints += 50;
                            comparisonValue = Math.max(comparisonValue, 450);
                            labels.add("Sequence of 4");
                        } else {
                            meldPoints += 20;
                            comparisonValue = Math.max(comparisonValue, 400);
                            labels.add("Sequence of 3");
                        }
                    }
                    runLength = 1;
                }
            }

            return new MeldAward(player, meldPoints, belaPoints, comparisonValue, labels);
        }

        private static boolean hasBela(List<Card> cards, Suit trumpSuit) {
            boolean hasKing = cards.stream().anyMatch(card -> card.suit == trumpSuit && card.rank == Rank.KING);
            boolean hasQueen = cards.stream().anyMatch(card -> card.suit == trumpSuit && card.rank == Rank.QUEEN);
            return hasKing && hasQueen;
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
