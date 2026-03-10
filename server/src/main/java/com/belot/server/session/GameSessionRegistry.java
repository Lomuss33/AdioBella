package com.belot.server.session;

import com.belot.engine.api.Difficulty;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GameSessionRegistry {

    private final ConcurrentMap<UUID, GameSession> sessions = new ConcurrentHashMap<>();

    public GameSession createSession(Difficulty difficulty) {
        GameSession session = new GameSession(UUID.randomUUID(), difficulty);
        sessions.put(session.id(), session);
        return session;
    }

    public GameSession requireSession(UUID sessionId) {
        GameSession session = sessions.get(sessionId);
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found.");
        }
        return session;
    }
}
