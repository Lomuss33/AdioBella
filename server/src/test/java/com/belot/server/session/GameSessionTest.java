package com.belot.server.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.belot.engine.api.Difficulty;
import com.belot.engine.api.GameEvent;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GameSessionTest {

    @Test
    void eventsAreOrderedAndReplayable() {
        GameSession session = new GameSession(UUID.randomUUID(), Difficulty.NORMAL);
        List<GameEvent> initialEvents = session.eventsAfter(0);

        assertEquals(1, initialEvents.size());

        session.startMatch();
        List<GameEvent> allEvents = session.eventsAfter(0);
        List<GameEvent> replay = session.eventsAfter(initialEvents.get(0).sequence());

        assertTrue(allEvents.size() > initialEvents.size());
        assertFalse(replay.isEmpty());
        assertTrue(replay.get(0).sequence() > initialEvents.get(0).sequence());
    }
}
