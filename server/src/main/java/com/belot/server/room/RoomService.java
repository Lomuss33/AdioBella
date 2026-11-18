package com.belot.server.room;

import com.belot.engine.api.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** A small, single-server room store. No external service or paid resource is used. */
@Service
public final class RoomService {
    private static final List<String> SEATS = List.of("south", "west", "north", "east");
    private final ObjectMapper json;
    private final Path directory;
    private final int maxRooms;
    private final SecureRandom random = new SecureRandom();
    private final Map<UUID, Room> rooms = new HashMap<>();

    public RoomService(ObjectMapper json,
            @Value("${belot.rooms.directory:data/rooms}") String directory,
            @Value("${belot.rooms.max-rooms:100}") int maxRooms) {
        this.json = json;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        this.maxRooms = maxRooms;
    }

    public synchronized Access create(String name) {
        String token = token();
        Member host = new Member("south", name(name), hash(token));
        try {
            Files.createDirectories(directory);
            try (var files = Files.list(directory)) {
                if (files.filter(path -> path.getFileName().toString().endsWith(".json")).count() >= maxRooms) {
                    throw failure(HttpStatus.SERVICE_UNAVAILABLE, "Room capacity reached.");
                }
            }
            var data = new SavedRoom(1, UUID.randomUUID(), random.nextLong(), 0, List.of(host), List.of());
            var room = new Room(data);
            write(data);
            rooms.put(data.id(), room);
            return new Access(token, room.view(host));
        } catch (IOException exception) {
            throw storageError(exception);
        }
    }

    public Access join(UUID id, String name, String requestedSeat) {
        Room room = require(id);
        synchronized (room) {
            if (!room.facade.getSnapshot().phase().equals("READY_TO_START")) {
                throw failure(HttpStatus.CONFLICT, "This match has already started.");
            }
            String seat = requestedSeat;
            if (seat == null || !SEATS.contains(seat)) throw new IllegalArgumentException("Choose a seat.");
            if (room.data.members().stream().anyMatch(member -> member.seat().equals(requestedSeat))) {
                throw failure(HttpStatus.CONFLICT, "That seat is already occupied.");
            }
            String token = token();
            Member member = new Member(seat, name(name), hash(token));
            List<Member> members = new ArrayList<>(room.data.members());
            members.add(member);
            var updated = new SavedRoom(1, id, room.data.seed(), room.data.revision() + 1, List.copyOf(members), room.data.commands());
            // Build and write before making the new membership visible.
            BelotMatchFacade facade = replay(updated);
            save(updated);
            room.data = updated;
            room.facade = facade;
            return new Access(token, room.view(member));
        }
    }

    public RoomView read(UUID id, String token) {
        Room room = require(id);
        synchronized (room) { return room.view(room.authenticate(token)); }
    }

    public RoomView act(UUID id, String token, CommandRequest request) {
        Room room = require(id);
        synchronized (room) {
            Member actor = room.authenticate(token);
            if (request == null || request.requestId() == null || request.action() == null) {
                throw new IllegalArgumentException("An action and request ID are required.");
            }
            var command = new Command(request.requestId(), actor.seat(), request.action(), request.choice(), request.handIndex(),
                    request.declare(), request.callBela(), request.difficulty(), request.gameLength(), request.matchTargetWins());
            var previous = room.data.commands().stream().filter(item -> item.requestId().equals(request.requestId())).findFirst();
            if (previous.isPresent()) {
                if (!previous.get().equals(command)) throw failure(HttpStatus.CONFLICT, "Request ID has already been used.");
                return room.view(actor);
            }
            if (request.revision() != room.data.revision()) throw failure(HttpStatus.CONFLICT, "The room changed. Refresh and try again.");
            if (room.data.commands().size() >= 10000) throw failure(HttpStatus.SERVICE_UNAVAILABLE, "This room has reached its move limit.");
            var view = room.facade.getSnapshotForPlayer(actor.seat());
            if (request.action().equals("SETTINGS")) {
                if (!actor.seat().equals("south")) throw failure(HttpStatus.FORBIDDEN, "Only the host can change settings.");
            } else if (!request.action().equals("FORFEIT") && !request.action().equals("FORFEIT_GAME")) {
                if (!actor.seat().equals(view.pendingAction().actingPlayerId())) {
                    throw failure(HttpStatus.FORBIDDEN, "It is another player's turn.");
                }
                ActionType expected = switch (request.action()) {
                    case "START" -> view.phase().equals("READY_TO_START") ? ActionType.START_MATCH : ActionType.START_NEXT_GAME;
                    case "TRUMP" -> ActionType.CHOOSE_TRUMP;
                    case "MELDS" -> ActionType.REPORT_MELDS;
                    case "ACK" -> ActionType.ACKNOWLEDGE_MELDS;
                    case "CARD" -> ActionType.PLAY_CARD;
                    default -> throw new IllegalArgumentException("Unknown room action.");
                };
                if (view.pendingAction().type() != expected) throw failure(HttpStatus.CONFLICT, "That action is not available.");
            }
            try {
                apply(room.facade, command);
                List<Command> commands = new ArrayList<>(room.data.commands());
                commands.add(command);
                var updated = new SavedRoom(1, id, room.data.seed(), room.data.revision() + 1, room.data.members(), List.copyOf(commands));
                save(updated);
                room.data = updated;
            } catch (RuntimeException exception) {
                // Invalid actions and disk failures must not leave an uncommitted turn in memory.
                room.facade = replay(room.data);
                throw exception;
            }
            return room.view(actor);
        }
    }

    private synchronized Room require(UUID id) {
        Room existing = rooms.get(id);
        if (existing != null) return existing;
        Path file = directory.resolve(id + ".json");
        if (!Files.exists(file)) throw failure(HttpStatus.NOT_FOUND, "Room not found.");
        try {
            if (Files.size(file) > 8_000_000) throw new IOException("Room file is too large.");
            SavedRoom data = json.readValue(file.toFile(), SavedRoom.class);
            if (data.version() != 1 || !id.equals(data.id())) throw new IOException("Unsupported room file.");
            Room room = new Room(data);
            rooms.put(id, room);
            return room;
        } catch (IOException | IllegalArgumentException exception) {
            throw storageError(exception);
        }
    }

    private BelotMatchFacade replay(SavedRoom data) {
        var facade = new BelotMatchFacade(new Random(data.seed()), Difficulty.NORMAL);
        Set<String> humans = new HashSet<>();
        Map<String, String> names = new HashMap<>();
        data.members().forEach(member -> { humans.add(member.seat()); names.put(member.seat().toUpperCase(Locale.ROOT), member.name()); });
        facade.configureHumanPlayers(humans);
        facade.updatePlayerNames(names);
        facade.updateLobbySettings(Difficulty.NORMAL, Map.of(), "Team A", "Team B", 1, GameLength.SHORT);
        for (Command command : data.commands()) apply(facade, command);
        return facade;
    }

    private void apply(BelotMatchFacade facade, Command command) {
        switch (command.action()) {
            case "START" -> facade.startMatch();
            case "TRUMP" -> {
                if (command.choice() == null) throw new IllegalArgumentException("Choose trump.");
                facade.chooseTrump(command.choice());
            }
            case "MELDS" -> {
                if (command.declare() == null) throw new IllegalArgumentException("Choose whether to declare melds.");
                facade.reportMelds(command.declare());
            }
            case "ACK" -> facade.acknowledgeMelds();
            case "CARD" -> {
                if (command.handIndex() == null) throw new IllegalArgumentException("Choose a card.");
                facade.playCard(command.handIndex(), Boolean.TRUE.equals(command.callBela()));
            }
            case "FORFEIT_GAME" -> facade.forfeitGame(command.seat());
            case "FORFEIT" -> facade.forfeitMatch(command.seat());
            case "SETTINGS" -> facade.updateLobbySettings(command.difficulty(), Map.of(), "Team A", "Team B", command.matchTargetWins(), command.gameLength());
            default -> throw new IllegalArgumentException("Unknown room action.");
        }
    }

    private void save(SavedRoom data) {
        try { write(data); } catch (IOException exception) { throw storageError(exception); }
    }

    private void write(SavedRoom data) throws IOException {
        Files.createDirectories(directory);
        Path temp = Files.createTempFile(directory, ".room-", ".tmp");
        try {
            json.writeValue(temp.toFile(), data);
            // Force data before atomically replacing the last committed save.
            try (var channel = java.nio.channels.FileChannel.open(temp, StandardOpenOption.WRITE)) { channel.force(true); }
            Files.move(temp, directory.resolve(data.id() + ".json"), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temp); }
    }

    private String token() {
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private static String name(String value) {
        if (value == null || value.isBlank() || value.strip().length() > 24 || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("Enter a player name of 1–24 characters.");
        }
        return value.strip();
    }

    private static ResponseStatusException failure(HttpStatus status, String message) { return new ResponseStatusException(status, message); }
    private static ResponseStatusException storageError(Exception exception) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to save or restore this room.", exception);
    }

    private final class Room {
        private SavedRoom data;
        private BelotMatchFacade facade;
        Room(SavedRoom data) { this.data = data; facade = replay(data); }

        Member authenticate(String token) {
            if (token == null || token.length() > 128) throw failure(HttpStatus.UNAUTHORIZED, "Room access is required.");
            byte[] candidate = hash(token).getBytes(StandardCharsets.UTF_8);
            return data.members().stream().filter(member -> MessageDigest.isEqual(candidate, member.tokenHash().getBytes(StandardCharsets.UTF_8)))
                    .findFirst().orElseThrow(() -> failure(HttpStatus.UNAUTHORIZED, "Room access is invalid."));
        }

        RoomView view(Member viewer) {
            GameSnapshot snapshot = facade.getSnapshotForPlayer(viewer.seat());
            var seats = SEATS.stream().map(seat -> new SeatView(seat,
                    data.members().stream().filter(member -> member.seat().equals(seat)).map(Member::name).findFirst().orElse("Bot"),
                    data.members().stream().anyMatch(member -> member.seat().equals(seat)))).toList();
            // Only public events are included; opponent hands and undeclared melds never leave the engine.
            var events = facade.getEventsAfter(Math.max(0, snapshot.lastEventSequence() - 40));
            return new RoomView(data.id(), data.revision(), viewer.seat(), viewer.seat().equals("south"), seats, snapshot, events);
        }
    }

    public record CommandRequest(UUID requestId, long revision, String action, TrumpChoice choice, Integer handIndex,
            Boolean declare, Boolean callBela, Difficulty difficulty, GameLength gameLength, Integer matchTargetWins) {}
    public record Access(String token, RoomView room) {}
    public record SeatView(String seat, String name, boolean human) {}
    public record RoomView(UUID roomId, long revision, String yourSeat, boolean host, List<SeatView> seats, GameSnapshot snapshot, List<GameEvent> events) {}
    public record Member(String seat, String name, String tokenHash) {}
    public record Command(UUID requestId, String seat, String action, TrumpChoice choice, Integer handIndex,
            Boolean declare, Boolean callBela, Difficulty difficulty, GameLength gameLength, Integer matchTargetWins) {}
    public record SavedRoom(int version, UUID id, long seed, long revision, List<Member> members, List<Command> commands) {}
}
