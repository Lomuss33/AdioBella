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
                                  "enemyTeamName":"Red Team"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshot.score.teamOneName").value("Blue Team"))
                .andExpect(jsonPath("$.snapshot.score.teamTwoName").value("Red Team"))
                .andExpect(jsonPath("$.snapshot.players[0].name").value("Lovro"))
                .andExpect(jsonPath("$.snapshot.score.difficulty").value("HARD"));
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
