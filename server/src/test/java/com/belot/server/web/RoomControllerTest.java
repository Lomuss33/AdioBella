package com.belot.server.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.belot.server.room.RoomService;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(RoomController.class)
@Import({RoomService.class, RoomCorsConfiguration.class})
class RoomControllerTest {
    static final Path DIRECTORY = Path.of(System.getProperty("java.io.tmpdir"), "belot-http-test-" + UUID.randomUUID());
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("belot.rooms.directory", DIRECTORY::toString);
        registry.add("belot.rooms.allowed-origins", () -> "https://belot.example");
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @AfterAll static void cleanup() throws Exception {
        if (Files.exists(DIRECTORY)) try (var files = Files.walk(DIRECTORY)) {
            for (Path file : files.sorted(Comparator.reverseOrder()).toList()) Files.delete(file);
        }
    }

    @Test void createJoinStartAndPrivateReadsWorkThroughHttp() throws Exception {
        var host = create();
        String id = host.path("room").path("roomId").asText();
        var joined = json.readTree(mvc.perform(post("/api/rooms/{id}/join", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Friend\",\"seat\":\"north\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/rooms/{id}", id)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/rooms/{id}", id).header("Authorization", "Bearer wrong")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/rooms/{id}/actions", id).header("Authorization", "Bearer " + host.path("token").asText())
                .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"START\",\"revision\":1,\"requestId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.snapshot.players[0].hand[0].faceUp").value(true))
                .andExpect(jsonPath("$.snapshot.players[2].hand[0].faceUp").value(false))
                .andExpect(jsonPath("$.snapshot.players[2].hand[0].rank").isEmpty());
        mvc.perform(get("/api/rooms/{id}", id).header("Authorization", "Bearer " + joined.path("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.yourSeat").value("north"))
                .andExpect(jsonPath("$.snapshot.players[0].hand[0].faceUp").value(false))
                .andExpect(jsonPath("$.snapshot.players[2].hand[0].faceUp").value(true))
                .andExpect(jsonPath("$.snapshot.pendingAction.type").value("NONE"))
                .andExpect(jsonPath("$.snapshot.pendingAction.legalTrumpChoices").isEmpty());
        mvc.perform(get("/api/sessions/{id}", id)).andExpect(status().isNotFound());
    }

    @Test void invalidBodiesAreRejectedAndCorsOnlyAllowsTheConfiguredSite() throws Exception {
        mvc.perform(post("/api/rooms").contentType(MediaType.APPLICATION_JSON).content("null")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/rooms").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \"}")).andExpect(status().isBadRequest());
        mvc.perform(options("/api/rooms").header("Origin", "https://belot.example")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "Authorization, Content-Type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "https://belot.example"));
        mvc.perform(options("/api/rooms").header("Origin", "https://other.example").header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    private JsonNode create() throws Exception {
        return json.readTree(mvc.perform(post("/api/rooms").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Host\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
}
