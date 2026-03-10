package com.belot.server.web;

import com.belot.engine.api.Difficulty;
import com.belot.engine.api.GameEvent;
import com.belot.engine.api.GameLength;
import com.belot.engine.api.GameSnapshot;
import com.belot.engine.api.TrumpChoice;
import java.util.List;
import com.belot.server.session.GameSession;
import com.belot.server.session.GameSessionRegistry;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.updatePlayerNames(request.playerNamesBySeat()));
    }

    @PostMapping("/{sessionId}/settings")
    public SessionResponse updateLobbySettings(@PathVariable UUID sessionId, @RequestBody LobbySettingsRequest request) {
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
        GameSession session = sessions.requireSession(sessionId);
        TrumpChoice choice = TrumpChoice.valueOf(request.choice());
        return new SessionResponse(session.id().toString(), session.chooseTrump(choice));
    }

    @PostMapping("/{sessionId}/card")
    public SessionResponse playCard(@PathVariable UUID sessionId, @RequestBody PlayCardRequest request) {
        GameSession session = sessions.requireSession(sessionId);
        return new SessionResponse(session.id().toString(), session.playCard(request.handIndex()));
    }

    @GetMapping(value = "/{sessionId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable UUID sessionId, @RequestParam(defaultValue = "0") long afterSequence) {
        return sessions.requireSession(sessionId).openStream(afterSequence);
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

    public record PlayCardRequest(int handIndex) {
    }

    public record SessionResponse(String sessionId, GameSnapshot snapshot) {
    }
}
