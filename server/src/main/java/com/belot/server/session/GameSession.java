package com.belot.server.session;

import com.belot.engine.api.BelotMatchFacade;
import com.belot.engine.api.Difficulty;
import com.belot.engine.api.GameEvent;
import com.belot.engine.api.GameLength;
import com.belot.engine.api.GameSnapshot;
import com.belot.engine.api.TrumpChoice;
import java.io.IOException;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public final class GameSession {

    private final UUID id;
    private final BelotMatchFacade facade;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    private long broadcastSequence;

    public GameSession(UUID id, Difficulty difficulty) {
        this.id = id;
        this.facade = new BelotMatchFacade(new Random(), difficulty);
        this.broadcastSequence = 0L;
    }

    public UUID id() {
        return id;
    }

    public synchronized GameSnapshot snapshot() {
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot startMatch() {
        facade.startMatch();
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot updatePlayerNames(java.util.Map<String, String> playerNamesBySeat) {
        facade.updatePlayerNames(playerNamesBySeat);
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot updateLobbySettings(
            Difficulty difficulty,
            java.util.Map<String, String> playerNamesBySeat,
            String yourTeamName,
            String enemyTeamName,
            Integer matchTargetWins,
            GameLength gameLength
    ) {
        facade.updateLobbySettings(difficulty, playerNamesBySeat, yourTeamName, enemyTeamName, matchTargetWins, gameLength);
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot chooseTrump(TrumpChoice choice) {
        facade.chooseTrump(choice);
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot reportMelds(boolean declare) {
        facade.reportMelds(declare);
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot acknowledgeMelds() {
        facade.acknowledgeMelds();
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot playCard(int handIndex, boolean callBela) {
        facade.playCard(handIndex, callBela);
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot forfeitGame() {
        facade.forfeitGame();
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized GameSnapshot forfeitMatch() {
        facade.forfeitMatch();
        broadcastNewEvents();
        return facade.getSnapshot();
    }

    public synchronized SseEmitter openStream(long afterSequence) {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        sendEvents(emitter, facade.getEventsAfter(afterSequence));
        return emitter;
    }

    public synchronized List<GameEvent> eventsAfter(long sequence) {
        return facade.getEventsAfter(sequence);
    }

    private void broadcastNewEvents() {
        List<GameEvent> newEvents = facade.getEventsAfter(broadcastSequence);
        if (newEvents.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                sendEvents(emitter, newEvents);
            } catch (RuntimeException exception) {
                emitters.remove(emitter);
            }
        }

        broadcastSequence = newEvents.get(newEvents.size() - 1).sequence();
    }

    private void sendEvents(SseEmitter emitter, List<GameEvent> sessionEvents) {
        try {
            for (GameEvent event : sessionEvents) {
                emitter.send(SseEmitter.event().id(String.valueOf(event.sequence())).data(event));
            }
        } catch (IOException exception) {
            emitters.remove(emitter);
            throw new IllegalStateException("Unable to send server-sent event.", exception);
        }
    }
}
