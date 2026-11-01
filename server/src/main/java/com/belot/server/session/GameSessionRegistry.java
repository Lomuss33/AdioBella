package com.belot.server.session;

import com.belot.engine.api.Difficulty;
import java.time.Duration;
import java.util.Comparator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GameSessionRegistry {

    static final long DEFAULT_IDLE_TTL_MILLIS = Duration.ofHours(2).toMillis();
    static final int DEFAULT_MAX_SESSIONS = 500;

    private final ConcurrentMap<UUID, GameSession> sessions = new ConcurrentHashMap<>();
    private final LongSupplier clockMillis;
    private final long idleTtlMillis;
    private final int maxSessions;

    @Autowired
    public GameSessionRegistry() {
        this(System::currentTimeMillis, DEFAULT_IDLE_TTL_MILLIS, DEFAULT_MAX_SESSIONS);
    }

    GameSessionRegistry(LongSupplier clockMillis, long idleTtlMillis, int maxSessions) {
        this.clockMillis = clockMillis;
        this.idleTtlMillis = idleTtlMillis;
        this.maxSessions = maxSessions;
    }

    public GameSession createSession(Difficulty difficulty) {
        long now = clockMillis.getAsLong();
        evictExpired(now);
        while (sessions.size() >= maxSessions) {
            Map.Entry<UUID, GameSession> oldest = sessions.entrySet().stream()
                    .min(Comparator.comparingLong(entry -> entry.getValue().lastAccessedMillis()))
                    .orElse(null);
            if (oldest == null) {
                break;
            }
            if (sessions.remove(oldest.getKey(), oldest.getValue())) {
                oldest.getValue().closeStreams();
            }
        }
        GameSession session = new GameSession(UUID.randomUUID(), difficulty);
        session.touch(now);
        sessions.put(session.id(), session);
        return session;
    }

    public GameSession requireSession(UUID sessionId) {
        long now = clockMillis.getAsLong();
        evictExpired(now);
        GameSession session = sessions.get(sessionId);
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found.");
        }
        session.touch(now);
        return session;
    }

    int activeSessionCount() {
        return sessions.size();
    }

    private void evictExpired(long nowMillis) {
        for (Map.Entry<UUID, GameSession> entry : sessions.entrySet()) {
            GameSession session = entry.getValue();
            if (nowMillis - session.lastAccessedMillis() > idleTtlMillis) {
                if (sessions.remove(entry.getKey(), session)) {
                    session.closeStreams();
                }
            }
        }
    }
}
