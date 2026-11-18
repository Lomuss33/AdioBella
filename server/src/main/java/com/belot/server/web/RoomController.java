package com.belot.server.web;

import com.belot.server.room.RoomService;
import com.belot.server.room.RoomService.*;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
public final class RoomController {
    private final RoomService rooms;
    public RoomController(RoomService rooms) { this.rooms = rooms; }

    @ModelAttribute
    public void noCache(jakarta.servlet.http.HttpServletResponse response) { response.setHeader("Cache-Control", "no-store"); }

    @PostMapping
    public Access create(@RequestBody CreateRequest request) {
        if (request == null) throw new IllegalArgumentException("A name is required.");
        return rooms.create(request.name());
    }

    @PostMapping("/{id}/join")
    public Access join(@PathVariable UUID id, @RequestBody JoinRequest request) {
        if (request == null) throw new IllegalArgumentException("A name and seat are required.");
        return rooms.join(id, request.name(), request.seat());
    }

    @GetMapping("/{id}")
    public RoomView read(@PathVariable UUID id, @RequestHeader(name = "Authorization", required = false) String authorization) {
        return rooms.read(id, bearer(authorization));
    }

    @PostMapping("/{id}/actions")
    public RoomView act(@PathVariable UUID id, @RequestHeader(name = "Authorization", required = false) String authorization,
            @RequestBody CommandRequest request) {
        return rooms.act(id, bearer(authorization), request);
    }

    private String bearer(String authorization) {
        return authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : null;
    }
    public record CreateRequest(String name) {}
    public record JoinRequest(String name, String seat) {}
}
