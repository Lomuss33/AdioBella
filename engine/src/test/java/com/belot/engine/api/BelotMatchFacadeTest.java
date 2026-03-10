package com.belot.engine.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.junit.jupiter.api.Test;

class BelotMatchFacadeTest {

    @Test
    void newMatchStartsInReadyState() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        GameSnapshot snapshot = facade.getSnapshot();

        assertEquals("READY_TO_START", snapshot.phase());
        assertEquals(ActionType.START_MATCH, snapshot.pendingAction().type());
        assertEquals(4, snapshot.players().size());
        assertEquals("Us", snapshot.score().teamOneName());
        assertEquals("Them", snapshot.score().teamTwoName());
        assertEquals("You", snapshot.players().get(0).name());
        assertEquals("Zapad", snapshot.players().get(1).name());
        assertEquals("Ti", snapshot.players().get(2).name());
        assertEquals("Istok", snapshot.players().get(3).name());
    }

    @Test
    void startMatchDealsCardsAndRequestsTrump() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        facade.startMatch();

        GameSnapshot snapshot = facade.getSnapshot();

        assertEquals("TRUMP_SELECTION", snapshot.phase());
        assertEquals(ActionType.CHOOSE_TRUMP, snapshot.pendingAction().type());
        assertEquals(24, snapshot.players().stream().mapToInt(PlayerView::handSize).sum());
        assertEquals(6, snapshot.players().get(0).handSize());
    }

    @Test
    void humanPlayConsumesTheSelectedCard() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        facade.startMatch();
        facade.chooseTrump(TrumpChoice.HEARTS);

        GameSnapshot beforePlay = facade.getSnapshot();
        int playableIndex = beforePlay.pendingAction().legalCardIndices().get(0);

        facade.playCard(playableIndex);

        GameSnapshot afterPlay = facade.getSnapshot();

        assertEquals(8, beforePlay.players().get(0).handSize());
        assertEquals(7, afterPlay.players().get(0).handSize());
        assertNotNull(afterPlay.trick());
        assertFalse(afterPlay.trick().cards().isEmpty());
    }

    @Test
    void displayedGamePointsUpdateDuringTheCurrentHand() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        facade.startMatch();
        facade.chooseTrump(TrumpChoice.HEARTS);

        int beforePoints = facade.getSnapshot().score().teamOneGamePoints() + facade.getSnapshot().score().teamTwoGamePoints();
        facade.playCard(facade.getSnapshot().pendingAction().legalCardIndices().get(0));
        GameSnapshot afterPlay = facade.getSnapshot();

        assertTrue(afterPlay.score().teamOneGamePoints() + afterPlay.score().teamTwoGamePoints() >= beforePoints);
        assertTrue(afterPlay.score().teamOneGamePoints() > 0 || afterPlay.score().teamTwoGamePoints() > 0);
    }

    @Test
    void invalidCardPlayIsRejected() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        facade.startMatch();
        facade.chooseTrump(TrumpChoice.SPADES);

        assertThrows(IllegalArgumentException.class, () -> facade.playCard(99));
        assertNotNull(facade.getSnapshot().pendingAction().validationMessage());
    }

    @Test
    void engineCanAdvanceThroughMultipleTurns() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        facade.startMatch();
        facade.chooseTrump(TrumpChoice.CLUBS);

        for (int step = 0; step < 12 && !facade.getSnapshot().matchComplete(); step++) {
            GameSnapshot snapshot = facade.getSnapshot();
            if (snapshot.pendingAction().type() == ActionType.PLAY_CARD) {
                facade.playCard(snapshot.pendingAction().legalCardIndices().get(0));
            }
        }

        assertTrue(facade.getEventsAfter(0).size() > 5);
    }

    @Test
    void playCardEventContainsAnimationPayload() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        facade.startMatch();
        facade.chooseTrump(TrumpChoice.HEARTS);

        GameSnapshot snapshot = facade.getSnapshot();
        facade.playCard(snapshot.pendingAction().legalCardIndices().get(0));

        GameEvent playEvent = facade.getEventsAfter(0).stream()
                .filter(event -> "PLAY_CARD".equals(event.payload().get("eventKind")))
                .findFirst()
                .orElseThrow();

        assertEquals("south", playEvent.payload().get("playerId"));
        assertEquals("SOUTH", playEvent.payload().get("playerSeat"));
        assertNotNull(playEvent.payload().get("rank"));
        assertNotNull(playEvent.payload().get("suit"));
    }

    @Test
    void trickWinEventContainsWinnerSeatPointsAndLastTrickBonusField() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));
        facade.startMatch();
        facade.chooseTrump(TrumpChoice.SPADES);

        for (int step = 0; step < 32 && facade.getSnapshot().pendingAction().type() == ActionType.PLAY_CARD; step++) {
            GameSnapshot snapshot = facade.getSnapshot();
            facade.playCard(snapshot.pendingAction().legalCardIndices().get(0));
            if (facade.getEventsAfter(0).stream().anyMatch(event -> "TRICK_WIN".equals(event.payload().get("eventKind")))) {
                break;
            }
        }

        GameEvent trickWinEvent = facade.getEventsAfter(0).stream()
                .filter(event -> "TRICK_WIN".equals(event.payload().get("eventKind")))
                .findFirst()
                .orElseThrow();

        assertNotNull(trickWinEvent.payload().get("winnerSeat"));
        assertNotNull(trickWinEvent.payload().get("trickPoints"));
        assertNotNull(trickWinEvent.payload().get("lastTrickBonus"));
    }

    @Test
    void lobbySettingsCanRenameTeamsBeforeStart() {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));

        facade.updateLobbySettings(Difficulty.HARD, Map.of("SOUTH", "Lovro"), "Blue Team", "Red Team", 5, GameLength.SHORT);

        GameSnapshot snapshot = facade.getSnapshot();
        assertEquals("Blue Team", snapshot.score().teamOneName());
        assertEquals("Red Team", snapshot.score().teamTwoName());
        assertEquals("Lovro", snapshot.players().get(0).name());
        assertEquals("HARD", snapshot.score().difficulty());
        assertEquals(5, snapshot.score().matchTargetWins());
        assertEquals(501, snapshot.score().gameTargetPoints());
    }

    @Test
    void gameWinnerWaitsForExplicitNextGameStartWhenMatchContinues() throws Exception {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));

        facade.updateLobbySettings(Difficulty.NORMAL, Map.of(), null, null, 3, GameLength.SHORT);
        setGameStateForFinishedHand(facade, 500, 0, 21, 0, "YOURS");

        invokeFinishGame(facade);

        GameSnapshot snapshot = facade.getSnapshot();
        assertEquals("BETWEEN_GAMES", snapshot.phase());
        assertEquals(ActionType.START_NEXT_GAME, snapshot.pendingAction().type());
        assertEquals(1, snapshot.score().teamOneMatchScore());
        assertFalse(snapshot.matchComplete());
    }

    @Test
    void meldPointsCountOnlyForWinningTeamAndIncludeTeammateDeclarations() throws Exception {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));

        setTrumpAndDeclarer(facade, "HEARTS", "YOURS");
        setPlayerHand(facade, 0, "7H", "8H", "9H", "10H");
        setPlayerHand(facade, 1, "7S", "8S", "9S");
        setPlayerHand(facade, 2, "7C", "8C", "9C");
        setPlayerHand(facade, 3, "AD");

        invokeApplyMelds(facade);

        GameSnapshot snapshot = facade.getSnapshot();
        assertEquals(70, snapshot.score().teamOneMeldPoints());
        assertEquals(0, snapshot.score().teamTwoMeldPoints());
    }

    @Test
    void tiedHighestMeldGoesToTrumpCallingTeamAndCountsBothPartnersDeclarations() throws Exception {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));

        setTrumpAndDeclarer(facade, "HEARTS", "ENEMIES");
        setPlayerHand(facade, 0, "7H", "8H", "9H");
        setPlayerHand(facade, 1, "7S", "8S", "9S");
        setPlayerHand(facade, 2, "7C", "8C", "9C");
        setPlayerHand(facade, 3, "7D", "8D", "9D");

        invokeApplyMelds(facade);

        GameSnapshot snapshot = facade.getSnapshot();
        assertEquals(0, snapshot.score().teamOneMeldPoints());
        assertEquals(40, snapshot.score().teamTwoMeldPoints());
    }

    @Test
    void belaCountsForWinningDeclarationTeam() throws Exception {
        BelotMatchFacade facade = new BelotMatchFacade(new Random(7));

        setTrumpAndDeclarer(facade, "HEARTS", "YOURS");
        setPlayerHand(facade, 0, "QH", "KH");
        setPlayerHand(facade, 1, "AS");
        setPlayerHand(facade, 2, "AC");
        setPlayerHand(facade, 3, "AD");

        invokeApplyMelds(facade);

        GameSnapshot snapshot = facade.getSnapshot();
        assertEquals(20, snapshot.score().teamOneMeldPoints());
        assertEquals(0, snapshot.score().teamTwoMeldPoints());
    }

    private static void invokeApplyMelds(BelotMatchFacade facade) throws Exception {
        Method applyMelds = BelotMatchFacade.class.getDeclaredMethod("applyMelds");
        applyMelds.setAccessible(true);
        applyMelds.invoke(facade);
    }

    private static void invokeFinishGame(BelotMatchFacade facade) throws Exception {
        Method finishGame = BelotMatchFacade.class.getDeclaredMethod("finishGame");
        finishGame.setAccessible(true);
        finishGame.invoke(facade);
    }

    private static void setGameStateForFinishedHand(
            BelotMatchFacade facade,
            int teamOneGameScore,
            int teamTwoGameScore,
            int teamOneHandPoints,
            int teamTwoHandPoints,
            String declarerSide
    ) throws Exception {
        Object state = getState(facade);
        Class<?> stateClass = state.getClass();

        Field phaseField = stateClass.getDeclaredField("phase");
        phaseField.setAccessible(true);
        phaseField.set(state, enumValue("com.belot.engine.api.BelotMatchFacade$Phase", "TRICK_PLAY"));

        Field declarerField = stateClass.getDeclaredField("declarer");
        declarerField.setAccessible(true);
        declarerField.set(state, enumValue("com.belot.engine.api.BelotMatchFacade$TeamSide", declarerSide));

        Field gameNumberField = stateClass.getDeclaredField("gameNumber");
        gameNumberField.setAccessible(true);
        gameNumberField.setInt(state, 1);

        Field teamOneField = stateClass.getDeclaredField("teamOne");
        teamOneField.setAccessible(true);
        Object teamOne = teamOneField.get(state);
        setIntField(teamOne, "gameScore", teamOneGameScore);
        setIntField(teamOne, "trickPoints", teamOneHandPoints);
        setIntField(teamOne, "meldPoints", 0);

        Field teamTwoField = stateClass.getDeclaredField("teamTwo");
        teamTwoField.setAccessible(true);
        Object teamTwo = teamTwoField.get(state);
        setIntField(teamTwo, "gameScore", teamTwoGameScore);
        setIntField(teamTwo, "trickPoints", teamTwoHandPoints);
        setIntField(teamTwo, "meldPoints", 0);
    }

    private static void setTrumpAndDeclarer(BelotMatchFacade facade, String suitName, String teamSideName) throws Exception {
        Object state = getState(facade);
        Class<?> stateClass = state.getClass();
        Field trumpSuitField = stateClass.getDeclaredField("trumpSuit");
        trumpSuitField.setAccessible(true);
        trumpSuitField.set(state, enumValue("com.belot.engine.api.BelotMatchFacade$Suit", suitName));

        Field declarerField = stateClass.getDeclaredField("declarer");
        declarerField.setAccessible(true);
        declarerField.set(state, enumValue("com.belot.engine.api.BelotMatchFacade$TeamSide", teamSideName));
    }

    private static void setPlayerHand(BelotMatchFacade facade, int playerIndex, String... cards) throws Exception {
        Object state = getState(facade);
        Field playersField = state.getClass().getDeclaredField("players");
        playersField.setAccessible(true);
        List<?> players = (List<?>) playersField.get(state);
        Object player = players.get(playerIndex);

        Field handField = player.getClass().getDeclaredField("hand");
        handField.setAccessible(true);
        @SuppressWarnings("unchecked")
        List<Object> hand = (List<Object>) handField.get(player);
        hand.clear();
        for (String code : cards) {
            hand.add(createCard(code));
        }
    }

    private static Object getState(BelotMatchFacade facade) throws Exception {
        Field stateField = BelotMatchFacade.class.getDeclaredField("state");
        stateField.setAccessible(true);
        return stateField.get(facade);
    }

    private static void setIntField(Object target, String fieldName, int value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.setInt(target, value);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object enumValue(String className, String value) throws Exception {
        Class enumClass = Class.forName(className);
        return Enum.valueOf(enumClass, value);
    }

    private static Object createCard(String code) throws Exception {
        Class<?> suitClass = Class.forName("com.belot.engine.api.BelotMatchFacade$Suit");
        Class<?> rankClass = Class.forName("com.belot.engine.api.BelotMatchFacade$Rank");
        Class<?> cardClass = Class.forName("com.belot.engine.api.BelotMatchFacade$Card");
        Constructor<?> constructor = cardClass.getDeclaredConstructor(suitClass, rankClass);
        constructor.setAccessible(true);

        String rankCode = code.substring(0, code.length() - 1);
        char suitCode = code.charAt(code.length() - 1);
        Object suit = switch (suitCode) {
            case 'S' -> enumValue("com.belot.engine.api.BelotMatchFacade$Suit", "SPADES");
            case 'H' -> enumValue("com.belot.engine.api.BelotMatchFacade$Suit", "HEARTS");
            case 'D' -> enumValue("com.belot.engine.api.BelotMatchFacade$Suit", "DIAMONDS");
            case 'C' -> enumValue("com.belot.engine.api.BelotMatchFacade$Suit", "CLUBS");
            default -> throw new IllegalArgumentException("Unknown suit code: " + suitCode);
        };
        Object rank = switch (rankCode) {
            case "7" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "SEVEN");
            case "8" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "EIGHT");
            case "9" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "NINE");
            case "10" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "TEN");
            case "J" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "JACK");
            case "Q" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "QUEEN");
            case "K" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "KING");
            case "A" -> enumValue("com.belot.engine.api.BelotMatchFacade$Rank", "ACE");
            default -> throw new IllegalArgumentException("Unknown rank code: " + rankCode);
        };
        return constructor.newInstance(suit, rank);
    }
}
