package com.belot.server.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void completesAMatchThroughTheHttpContract() throws Exception {
        String sessionId = createSessionId();
        mockMvc.perform(post("/api/sessions/{sessionId}/settings", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"matchTargetWins\":1,\"gameLength\":\"SHORT\",\"difficulty\":\"HARD\"}"))
                .andExpect(status().isOk());
        String response = mockMvc.perform(post("/api/sessions/{sessionId}/start", sessionId))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode snapshot = objectMapper.readTree(response).path("snapshot");
        int actions = 0;
        while (!snapshot.path("matchComplete").asBoolean() && actions++ < 1000) {
            JsonNode pending = snapshot.path("pendingAction");
            String route, body;
            switch (pending.path("type").asText()) {
                case "CHOOSE_TRUMP" -> { route = "trump"; body = "{\"choice\":\"HEARTS\"}"; }
                case "REPORT_MELDS" -> { route = "melds"; body = "{\"declare\":true}"; }
                case "ACKNOWLEDGE_MELDS" -> { route = "melds/ack"; body = "{\"acknowledged\":true}"; }
                case "PLAY_CARD" -> {
                    int index = pending.path("legalCardIndices").get(0).asInt();
                    boolean bela = false;
                    for (JsonNode eligible : pending.path("belaEligibleCardIndices")) bela |= eligible.asInt() == index;
                    route = "card"; body = "{\"handIndex\":" + index + ",\"callBela\":" + bela + "}";
                }
                default -> throw new AssertionError("Unexpected pending action: " + pending);
            }
            response = mockMvc.perform(post("/api/sessions/{sessionId}/" + route, sessionId)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            snapshot = objectMapper.readTree(response).path("snapshot");
        }
        org.junit.jupiter.api.Assertions.assertTrue(snapshot.path("matchComplete").asBoolean());
        mockMvc.perform(get("/api/sessions/{sessionId}/events", sessionId))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.payload.eventKind == 'MATCH_WIN')]").isNotEmpty());
    }

    @Test
    void createsSessionAndReturnsSnapshot() throws Exception {
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"difficulty\":\"NORMAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.snapshot.pendingAction.type").value("START_MATCH"));
    }

    @Test
    void startsMatchAndLoadsCurrentSnapshot() throws Exception {
        String sessionId = createSessionId();

        mockMvc.perform(post("/api/sessions/{sessionId}/start", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshot.phase").value("TRUMP_SELECTION"))
                .andExpect(jsonPath("$.snapshot.pendingAction.type").value("CHOOSE_TRUMP"));

        mockMvc.perform(get("/api/sessions/{sessionId}", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshot.players.length()").value(4));
    }

    @Test
    void rejectsIllegalCardAction() throws Exception {
        String sessionId = createSessionId();

        mockMvc.perform(post("/api/sessions/{sessionId}/card", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"handIndex\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("That action is not expected right now."));
    }

    @Test
    void lobbySettingsCanUpdateTeamNames() throws Exception {
        String sessionId = createSessionId();

        mockMvc.perform(post("/api/sessions/{sessionId}/settings", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "difficulty":"HARD",
                                  "playerNamesBySeat":{"SOUTH":"Lovro"},
                                  "yourTeamName":"Blue Team",
                                  "enemyTeamName":"Red Team",
                                  "matchTargetWins":5,
                                  "gameLength":"SHORT"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshot.score.teamOneName").value("Blue Team"))
                .andExpect(jsonPath("$.snapshot.score.teamTwoName").value("Red Team"))
                .andExpect(jsonPath("$.snapshot.players[0].name").value("Lovro"))
                .andExpect(jsonPath("$.snapshot.score.difficulty").value("HARD"))
                .andExpect(jsonPath("$.snapshot.score.matchTargetWins").value(5))
                .andExpect(jsonPath("$.snapshot.score.gameTargetPoints").value(501));
    }

    private String createSessionId() throws Exception {
        String body = mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"difficulty\":\"NORMAL\"}"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(body);
        return json.get("sessionId").asText();
    }
}
