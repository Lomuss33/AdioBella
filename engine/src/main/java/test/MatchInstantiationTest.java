package controllers;

import ai.HumanPlayer;
import controllers.Game.Difficulty;
import models.Team;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

/**
 * FUNDAMENTAL TEST: Can we create a Match instance?
 * 
 * This is the most basic test. If this fails, nothing else can work.
 * Start here and verify each step.
 */
public class MatchInstantiationTest {
    
    private Match match;
    
    @BeforeEach
    public void setUp() {
        // Try to create a Match with EASY difficulty
        // This should initialize:
        // - team1 and team2
        // - 4 players (2 per team)
        // - dealerIndex set to 3
        // - me (HumanPlayer) set to player 0
        match = new Match(Difficulty.EASY);
    }
    
    @Test
    public void testMatchCanBeInstantiated() {
        // Basic existence check
        assertNotNull(match, "Match should not be null after instantiation");
    }
    
    @Test
    public void testMatchHasTeams() {
        // Verify both teams exist
        assertNotNull(match.team1, "Team 1 should not be null");
        assertNotNull(match.team2, "Team 2 should not be null");
        
        // Verify teams have names
        assertNotNull(match.team1.getName(), "Team 1 should have a name");
        assertNotNull(match.team2.getName(), "Team 2 should have a name");
    }
    
    @Test
    public void testMatchHasPlayers() {
        // Verify all 4 players exist
        assertNotNull(match.players, "Players list should not be null");
        assertEquals(4, match.players.size(), "Should have exactly 4 players");
        
        // Verify no player is null
        for (int i = 0; i < match.players.size(); i++) {
            assertNotNull(match.players.get(i), "Player at index " + i + " should not be null");
        }
    }
    
    @Test
    public void testMatchHasHumanPlayer() {
        // Verify HumanPlayer is initialized
        assertNotNull(match.me, "HumanPlayer (me) should not be null");
        assertTrue(match.me instanceof HumanPlayer, "Player 0 should be a HumanPlayer");
    }
    
    @Test
    public void testInitialDealerIndex() {
        // Dealer should start at index 3
        assertEquals(3, match.dealerIndex, "Initial dealer should be at index 3");
    }
    
    @Test
    public void testInitialGameCounter() {
        // Game counter should start at 0
        assertEquals(0, match.gameCounter, "Initial game counter should be 0");
    }
    
    @Test
    public void testTeamsInitialScores() {
        // Both teams should start with 0 score
        assertEquals(0, match.team1.getBigs(), "Team 1 should start with 0 bigs");
        assertEquals(0, match.team2.getBigs(), "Team 2 should start with 0 bigs");
        assertEquals(0, match.team1.getSmalls(), "Team 1 should start with 0 smalls");
        assertEquals(0, match.team2.getSmalls(), "Team 2 should start with 0 smalls");
    }
    
    @Test
    public void testPlayersAssignedToTeams() {
        // Verify players are assigned to teams
        // Typically: Player 0 & 2 on team1, Player 1 & 3 on team2 (or similar)
        // This test just verifies the structure
        for (var player : match.players) {
            assertNotNull(player.getTeam(), "Every player should belong to a team");
            assertTrue(
                player.getTeam() == match.team1 || player.getTeam() == match.team2,
                "Player should belong to team1 or team2"
            );
        }
    }
}