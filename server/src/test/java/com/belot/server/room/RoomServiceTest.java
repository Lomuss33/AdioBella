package com.belot.server.room;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.belot.engine.api.*;
import com.belot.server.room.RoomService.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;

class RoomServiceTest {
    @TempDir Path directory;
    private RoomService service() { return new RoomService(new ObjectMapper().findAndRegisterModules(), directory.toString(), 100); }
    private CommandRequest command(RoomView view, String action) {
        return new CommandRequest(UUID.randomUUID(), view.revision(), action, null, null, null, null, null, null, null);
    }
    private int status(Runnable action) { return assertThrows(ResponseStatusException.class, action::run).getStatusCode().value(); }

    @Test void roomDisplayDefaultsSurviveGuestJoinsMovesAndRestarts() {
        var rooms = service();
        var defaults = new DisplayDefaults("TEAL", "ivory", "french", true, "fast");
        var rules = new MatchRules(Difficulty.HARD, GameLength.LONG, 5);
        var host = rooms.create("Host", defaults, rules);
        var id = host.room().roomId();
        var friend = rooms.join(id, "Friend", "north");
        assertEquals(defaults, friend.room().displayDefaults());

        var hostView = rooms.read(id, host.token());
        rooms.act(id, host.token(), command(hostView, "START"));
        var restored = service().read(id, friend.token());
        assertEquals(defaults, restored.displayDefaults());
        assertEquals("HARD", restored.snapshot().score().difficulty());
        assertEquals(1001, restored.snapshot().score().gameTargetPoints());
        assertEquals(5, restored.snapshot().score().matchTargetWins());
    }

    @Test void privateSeatsTokensAndHostPermissionsAreEnforced() throws Exception {
        var rooms = service();
        var host = rooms.create("Host");
        UUID id = host.room().roomId();
        var friend = rooms.join(id, "Friend", "north");
        assertNotEquals(host.token(), friend.token());
        assertEquals(401, status(() -> rooms.read(id, "wrong")));
        assertEquals(401, status(() -> rooms.read(id, null)));
        assertEquals(409, status(() -> rooms.join(id, "Other", "north")));
        assertEquals(403, status(() -> rooms.act(id, friend.token(), command(friend.room(), "START"))));
        assertEquals(403, status(() -> rooms.act(id, friend.token(), command(friend.room(), "SETTINGS"))));
        var view = rooms.read(id, host.token());
        rooms.act(id, host.token(), command(view, "START"));
        assertEquals(409, status(() -> rooms.join(id, "Late", "west")));
        for (var member : List.of(host, friend)) {
            var snapshot = rooms.read(id, member.token()).snapshot();
            for (var player : snapshot.players()) for (var card : player.hand()) {
                assertEquals(player.id().equals(member.room().yourSeat()), card.faceUp());
                if (!card.faceUp()) { assertNull(card.rank()); assertNull(card.suit()); }
            }
        }
        String file = Files.readString(directory.resolve(id + ".json"));
        assertFalse(file.contains(host.token()));
        assertFalse(file.contains(friend.token()));
    }

    @Test void retriesAndStaleTabsCannotExecuteTheSameActionTwice() {
        var rooms = service();
        var host = rooms.create("Host");
        UUID id = host.room().roomId();
        var start = command(host.room(), "START");
        var started = rooms.act(id, host.token(), start);
        assertEquals(started.revision(), rooms.act(id, host.token(), start).revision());
        assertEquals(409, status(() -> rooms.act(id, host.token(), command(host.room(), "START"))));
        var conflicting = new CommandRequest(start.requestId(), started.revision(), "FORFEIT", null, null, null, null, null, null, null);
        assertEquals(409, status(() -> rooms.act(id, host.token(), conflicting)));
        assertEquals(started.snapshot(), rooms.read(id, host.token()).snapshot());
    }

    @Test void fourPlayersCanCompleteAMatchAcrossServerRestarts() {
        RoomService rooms = service();
        var host = rooms.create("Host");
        UUID id = host.room().roomId();
        Map<String, String> tokens = new HashMap<>(); tokens.put("south", host.token());
        for (String seat : List.of("west", "north", "east")) tokens.put(seat, rooms.join(id, seat, seat).token());
        var view = rooms.read(id, host.token());
        view = rooms.act(id, host.token(), command(view, "START"));
        int actions = 0;
        while (!view.snapshot().matchComplete() && actions++ < 1500) {
            String actor = view.snapshot().pendingAction().actingPlayerId();
            String token = tokens.get(actor);
            var actorView = rooms.read(id, token);
            var pending = actorView.snapshot().pendingAction();
            var action = switch (pending.type()) {
                case CHOOSE_TRUMP -> new CommandRequest(UUID.randomUUID(), view.revision(), "TRUMP", TrumpChoice.HEARTS, null, null, null, null, null, null);
                case REPORT_MELDS -> new CommandRequest(UUID.randomUUID(), view.revision(), "MELDS", null, null, true, null, null, null, null);
                case ACKNOWLEDGE_MELDS -> command(actorView, "ACK");
                case PLAY_CARD -> new CommandRequest(UUID.randomUUID(), view.revision(), "CARD", null, pending.legalCardIndices().getFirst(), null,
                        pending.belaEligibleCardIndices().contains(pending.legalCardIndices().getFirst()), null, null, null);
                default -> throw new AssertionError(pending.type());
            };
            view = rooms.act(id, token, action);
            if (actions % 11 == 0) {
                rooms = service(); // No in-memory registry survives this point.
                assertEquals(view.snapshot(), rooms.read(id, token).snapshot());
                assertEquals(view.revision(), rooms.read(id, token).revision());
                assertEquals(view.revision(), rooms.act(id, token, action).revision());
            }
        }
        assertTrue(view.snapshot().matchComplete());
        assertTrue(actions < 1500);
    }

    @Test void failedDiskWritesAndInvalidActionsDoNotCommitATurn() throws Exception {
        var mapper = spy(new ObjectMapper().findAndRegisterModules());
        var rooms = new RoomService(mapper, directory.toString(), 100);
        var host = rooms.create("Host");
        UUID id = host.room().roomId();
        var start = command(host.room(), "START");
        doThrow(new IOException("Disk full")).when(mapper).writeValue(any(File.class), any(Object.class));
        assertEquals(503, status(() -> rooms.act(id, host.token(), start)));
        assertEquals(host.room().snapshot(), rooms.read(id, host.token()).snapshot());
        doCallRealMethod().when(mapper).writeValue(any(File.class), any(Object.class));
        var started = rooms.act(id, host.token(), start);
        var invalid = new CommandRequest(UUID.randomUUID(), started.revision(), "TRUMP", null, null, null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> rooms.act(id, host.token(), invalid));
        assertEquals(started.snapshot(), rooms.read(id, host.token()).snapshot());
        assertEquals(started.revision(), service().read(id, host.token()).revision());
    }

    @Test void concurrentJoinHasOneWinnerAndCapacityIsBounded() throws Exception {
        var rooms = new RoomService(new ObjectMapper(), directory.toString(), 1);
        var host = rooms.create("Host");
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            Callable<Boolean> join = () -> {
                try { rooms.join(host.room().roomId(), "Friend", "north"); return true; }
                catch (ResponseStatusException conflict) { assertEquals(409, conflict.getStatusCode().value()); return false; }
            };
            var first = pool.submit(join); var second = pool.submit(join);
            assertNotEquals(first.get(), second.get());
        }
        assertEquals(503, status(() -> rooms.create("Another")));
    }
}
