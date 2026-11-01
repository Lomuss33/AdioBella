package com.belot.server.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.belot.engine.api.Difficulty;
import com.belot.engine.api.GameEvent;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

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

    @Test
    void registryEvictsIdleSessionsAndCapsCapacity() {
        AtomicLong clock = new AtomicLong(1_000L);
        GameSessionRegistry registry = new GameSessionRegistry(clock::get, 5_000L, 2);

        GameSession first = registry.createSession(Difficulty.NORMAL);
        clock.addAndGet(1_000L);
        GameSession second = registry.createSession(Difficulty.NORMAL);
        assertEquals(2, registry.activeSessionCount());

        // Creating a third session evicts the least-recently-accessed session (first).
        clock.addAndGet(1_000L);
        GameSession third = registry.createSession(Difficulty.NORMAL);
        assertEquals(2, registry.activeSessionCount());
        assertThrows(ResponseStatusException.class, () -> registry.requireSession(first.id()));
        assertEquals(second.id(), registry.requireSession(second.id()).id());

        // Advancing past idle TTL evicts remaining sessions.
        clock.addAndGet(10_000L);
        assertThrows(ResponseStatusException.class, () -> registry.requireSession(third.id()));
        assertEquals(0, registry.activeSessionCount());
    }
}
