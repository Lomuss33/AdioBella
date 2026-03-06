//package services;

// import java.util.*;
// import models.*;

public class GameStateManager {

    private final Stack<CurrentState> gameStates = new Stack<>(); // Stack to store game states

    /**
     * Saves the current game state to the stack.
     * @param currentState The current state of the game.
     */
    public void saveGameState(CurrentState currentState) {
        gameStates.push(currentState);
    }

    /**
     * Restores the last saved game state.
     * @return The last saved CurrentState, or null if no state exists.
     */
    public CurrentState goBackLastState() {
        if (gameStates.isEmpty()) {
            System.err.println("No game states to restore!");
            return null; // No state to restore
        }

        // Pop the last saved state
        return gameStates.pop();
    }

    /**
     * Creates a new CurrentState for the start of the game.
     */
    public static CurrentState createStartGameState(Team team1, Team team2, List<Player> players, ZvanjeService.ZvanjeResult zvanjeWin, int winTreshold, int dealerIndex) {
        return new CurrentState(team1, team2, players, zvanjeWin, winTreshold, dealerIndex);
    }

    /**
     * Creates a new CurrentState for mid-game.
     */
    public static CurrentState createMidGameState(Team team1, Team team2, List<Player> players, ZvanjeService.ZvanjeResult zvanjeWin, int winTreshold, int dealerIndex, 
                                                  Card.Suit trumpSuit, Card.Suit leadSuit, int startingPlayerIndex, List<Card> onFloorCards) {
        return new CurrentState(team1, team2, players, zvanjeWin, winTreshold, dealerIndex, trumpSuit, leadSuit, startingPlayerIndex, onFloorCards);
    }







    /**
     * Creates a new CurrentState for a round.
     */
    public static CurrentState createRoundState(List<Card> onFloorCards, Card.Suit trumpSuit, Team team1, Team team2, int startingPlayerIndex) {
        return new CurrentState(onFloorCards, trumpSuit, team1, team2, startingPlayerIndex);
    }
}
