package com.belot.server.web;

import java.util.List;
import java.util.UUID;
import com.belot.engine.api.Difficulty;
import com.belot.engine.api.GameEvent;
import com.belot.engine.api.GameLength;
import com.belot.engine.api.GameSnapshot;
import com.belot.engine.api.TrumpChoice;
import com.belot.server.session.GameSession;
import com.belot.server.session.GameSessionRegistry;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final GameSessionRegistry sessions;

    public SessionController(GameSessionRegistry sessions) {
        this.sessions = sessions;
    }

    @PostMapping
    public SessionResponse createSession(@RequestBody(required = false) CreateSessionRequest request) {
        Difficulty difficulty = request == null || request.difficulty() == null ? Difficulty.NORMAL : request.difficulty();
        GameSession session = sessions.createSession(difficulty);
        return new SessionResponse(session.id().toString(), session.snapshot());
    }

    @GetMapping("/{sessionId}")
    public SessionResponse getSession(@PathVariable UUID sessionId) {
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.snapshot());
    }

    @GetMapping("/{sessionId}/events")
    public List<GameEvent> events(@PathVariable UUID sessionId, @RequestParam(defaultValue = "0") long afterSequence) {
        GameSession session = sessions.requireSession(sessionId);
        return session.eventsAfter(afterSequence);
    }

    @PostMapping("/{sessionId}/start")
    public SessionResponse startMatch(@PathVariable UUID sessionId) {
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.startMatch());
    }

    @PostMapping("/{sessionId}/players")
    public SessionResponse updatePlayers(@PathVariable UUID sessionId, @RequestBody PlayerNamesRequest request) {
        request = requireBody(request);
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.updatePlayerNames(request.playerNamesBySeat()));
    }

    @PostMapping("/{sessionId}/settings")
    public SessionResponse updateLobbySettings(@PathVariable UUID sessionId, @RequestBody LobbySettingsRequest request) {
        request = requireBody(request);
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(
                session.id().toString(),
                session.updateLobbySettings(
                        request.difficulty(),
                        request.playerNamesBySeat(),
                        request.yourTeamName(),
                        request.enemyTeamName(),
                        request.matchTargetWins(),
                        request.gameLength()
                )
        );
    }

    @PostMapping("/{sessionId}/trump")
    public SessionResponse chooseTrump(@PathVariable UUID sessionId, @RequestBody TrumpChoiceRequest request) {
        request = requireBody(request);
        if (request.choice() == null) {
            throw new IllegalArgumentException("Trump choice is required.");
        }
        TrumpChoice choice = TrumpChoice.valueOf(request.choice());
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.chooseTrump(choice));
    }

    @PostMapping("/{sessionId}/melds")
    public SessionResponse reportMelds(@PathVariable UUID sessionId, @RequestBody ReportMeldsRequest request) {
        request = requireBody(request);
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.reportMelds(request.declare()));
    }

    @PostMapping("/{sessionId}/melds/ack")
    public SessionResponse acknowledgeMelds(@PathVariable UUID sessionId, @RequestBody AcknowledgeMeldsRequest request) {
        request = requireBody(request);
        if (!request.acknowledged()) {
            throw new IllegalArgumentException("Meld acknowledgement must be confirmed.");
        }

        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.acknowledgeMelds());
    }

    @PostMapping("/{sessionId}/card")
    public SessionResponse playCard(@PathVariable UUID sessionId, @RequestBody PlayCardRequest request) {
        request = requireBody(request);
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.playCard(request.handIndex(), Boolean.TRUE.equals(request.callBela())));
    }

    @PostMapping("/{sessionId}/forfeit")
    public SessionResponse forfeitGame(@PathVariable UUID sessionId) {
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.forfeitGame());
    }

    @PostMapping("/{sessionId}/quit")
    public SessionResponse forfeitMatch(@PathVariable UUID sessionId) {
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.forfeitMatch());
    }

    @GetMapping(value = "/{sessionId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "0") long afterSequence,
            @RequestHeader(name = "Last-Event-ID", required = false) String lastEventId
    ) {
        GameSession session = sessions.requireSession(sessionId);
        long latestSequence = session.snapshot().lastEventSequence();
        long resumeAfter = Math.min(Math.max(0, afterSequence), latestSequence);

        if (lastEventId != null && !lastEventId.isBlank()) {
            try {
                long parsedSequence = Long.parseLong(lastEventId);
                if (parsedSequence >= 0 && parsedSequence <= latestSequence) {
                    resumeAfter = Math.max(resumeAfter, parsedSequence);
                }
            } catch (NumberFormatException ignored) {
                // Fall back to the explicit query cursor when the reconnect header is malformed.
            }
        }

        return session.openStream(resumeAfter);
    }

    public record CreateSessionRequest(Difficulty difficulty) {
    }

    public record PlayerNamesRequest(java.util.Map<String, String> playerNamesBySeat) {
    }

    public record LobbySettingsRequest(
            Difficulty difficulty,
            java.util.Map<String, String> playerNamesBySeat,
            String yourTeamName,
            String enemyTeamName,
            Integer matchTargetWins,
            GameLength gameLength
    ) {
    }

    public record TrumpChoiceRequest(String choice) {
    }

    public record ReportMeldsRequest(boolean declare) {
    }

    public record AcknowledgeMeldsRequest(boolean acknowledged) {
    }

    public record PlayCardRequest(int handIndex, Boolean callBela) {
    }

    public record SessionResponse(String sessionId, GameSnapshot snapshot) {
    }

    private static <T> T requireBody(T body) {
        if (body == null) {
            throw new IllegalArgumentException("Request body is required.");
        }
        return body;
    }
}
