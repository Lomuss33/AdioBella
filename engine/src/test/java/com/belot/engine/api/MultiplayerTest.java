package com.belot.engine.api;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class MultiplayerTest {
    private static final List<String> PLAYERS = List.of("south", "west", "north", "east");

    private BelotMatchFacade game(int seed) {
        var game = new BelotMatchFacade(new Random(seed));
        game.configureHumanPlayers(Set.copyOf(PLAYERS));
        game.startMatch();
        return game;
    }

    @Test void eachPlayerSeesOnlyTheirOwnCardsAndAvailableActions() {
        var game = game(7);
        for (String viewer : PLAYERS) {
            var snapshot = game.getSnapshotForPlayer(viewer);
            assertEquals(viewer.equals("south") ? ActionType.CHOOSE_TRUMP : ActionType.NONE, snapshot.pendingAction().type());
            assertEquals("south", snapshot.pendingAction().actingPlayerId());
            for (var player : snapshot.players()) {
                assertEquals(6, player.handSize());
                for (var card : player.hand()) {
                    assertEquals(viewer.equals(player.id()), card.faceUp());
                    if (!viewer.equals(player.id())) { assertNull(card.rank()); assertNull(card.suit()); assertFalse(card.playable()); }
                }
            }
        }
        game.chooseTrump(TrumpChoice.SKIP);
        assertEquals(ActionType.CHOOSE_TRUMP, game.getSnapshotForPlayer("west").pendingAction().type());
        assertEquals(ActionType.NONE, game.getSnapshotForPlayer("south").pendingAction().type());
        assertThrows(IllegalArgumentException.class, () -> game.configureHumanPlayers(Set.of("south")));
    }

    @Test void multipleHumansCanDeclareMeldsAndPlayAWholeHandInOrder() {
        Set<String> meldActors = new HashSet<>();
        for (int seed = 1; seed <= 25; seed++) {
            var game = game(seed);
            game.chooseTrump(TrumpChoice.HEARTS);
            int played = 0;
            for (int step = 0; step < 45; step++) {
                String actor = game.getSnapshot().pendingAction().actingPlayerId();
                var view = game.getSnapshotForPlayer(actor);
                var pending = view.pendingAction();
                for (String other : PLAYERS) if (!other.equals(actor)) {
                    var hidden = game.getSnapshotForPlayer(other).pendingAction();
                    assertEquals(ActionType.NONE, hidden.type());
                    assertTrue(hidden.availableMelds().isEmpty());
                    assertTrue(hidden.legalCardIndices().isEmpty());
                    assertTrue(hidden.legalTrumpChoices().isEmpty());
                    assertTrue(game.getSnapshotForPlayer(other).players().stream().flatMap(player -> player.hand().stream()).noneMatch(CardView::playable));
                }
                if (pending.type() == ActionType.CHOOSE_TRUMP) break; // Next deal, after the 32 cards.
                switch (pending.type()) {
                    case REPORT_MELDS -> { meldActors.add(actor); game.reportMelds(true); }
                    case ACKNOWLEDGE_MELDS -> game.acknowledgeMelds();
                    case PLAY_CARD -> { int card = pending.legalCardIndices().getFirst(); game.playCard(card, pending.belaEligibleCardIndices().contains(card)); played++; }
                    default -> fail("Unexpected action " + pending.type());
                }
            }
            assertEquals(32, played);
            assertTrue(game.getEventsAfter(0).stream().anyMatch(event -> Set.of("HAND_PASSED", "HAND_FAILED").contains(event.payload().get("eventKind"))));
        }
        assertEquals(Set.copyOf(PLAYERS), meldActors);
    }

    @Test void forfeitUsesTheActorsTeam() {
        var game = game(7);
        game.forfeitMatch("west");
        assertTrue(game.getSnapshot().matchComplete());
        assertEquals(3, game.getSnapshot().score().teamOneMatchScore());
        assertEquals(0, game.getSnapshot().score().teamTwoMatchScore());
    }
}
