package com.belot.engine.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

        facade.updateLobbySettings(Difficulty.HARD, Map.of("SOUTH", "Lovro"), "Blue Team", "Red Team");

        GameSnapshot snapshot = facade.getSnapshot();
        assertEquals("Blue Team", snapshot.score().teamOneName());
        assertEquals("Red Team", snapshot.score().teamTwoName());
        assertEquals("Lovro", snapshot.players().get(0).name());
        assertEquals("HARD", snapshot.score().difficulty());
    }
}
