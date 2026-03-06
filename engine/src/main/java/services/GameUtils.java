//package services;

// import ai.*;
// import controllers.Game.Difficulty;
// import java.util.ArrayList;
// import java.util.List;
// import models.*;
// import services.ZvanjeService.ZvanjeResult;

public class GameUtils {
    
    // Initialize players and assign them to the given teams
    public static List<Player> initializePlayers(Difficulty difficulty, Team team1, Team team2) {
        List<Player> players = new ArrayList<>();

        // Assign human player to Team 1
        players.add(new HumanPlayer("Lovro", team1));

        // Create AI players based on difficulty
        switch (difficulty) {
            case EASY:
                players.add(new AiPlayerEasy("Bot 1", team2)); // Bot 1 in Team 2
                players.add(new AiPlayerEasy("Bot 2", team1)); // Bot 2 in Team 1
                players.add(new AiPlayerEasy("Bot 3", team2)); // Bot 3 in Team 2
                break;
            case NORMAL:
                players.add(new AiPlayerNormal("Bot 1", team2));
                players.add(new AiPlayerNormal("Bot 2", team1));
                players.add(new AiPlayerNormal("Bot 3", team2));
                break;
            case HARD:
                players.add(new AiPlayerHard("Bot 1", team2));
                players.add(new AiPlayerHard("Bot 2", team1));
                players.add(new AiPlayerHard("Bot 3", team2));
                break;
            case TEST:
                players.add(new AiPlayerEasy("Bot 1", team2));
                players.add(new AiPlayerNormal("Bot 2", team1));
                players.add(new AiPlayerHard("Bot 3", team2));
                break;
        }
        return players;
    }

    // Find the winner of the game
    public static Team findGameWinner(Team team1, Team team2, ZvanjeResult zvanjeWin, int winTreshold) {
        if (checkGamePass(team1, zvanjeWin)) {
            return team1;
        } else if (checkGamePass(team2, zvanjeWin)) {
            return team2;
        }
        return null;
    }

    // Check if the team has passed the game threshold
    public static boolean checkGamePass(Team team, ZvanjeResult zvanjeWin) {
        int threshold = calculateWinThreshold(zvanjeWin);
        // Check if the team has won Zvanje
        int zvanjePoints = (zvanjeWin != null && zvanjeWin.getWinningTeam() == team) ? zvanjeWin.getTotalPoints() : 0;
        // Check if the team has reached the threshold
        return (team.getSmalls() + zvanjePoints >= threshold);
    }

    // Calculate the threshold for winning the game
    public static int calculateWinThreshold(ZvanjeResult zvanjeWin) {
        int basePoints = 162; // Base points for a "čista igra"
        int zvanjePoints = (zvanjeWin != null) ? zvanjeWin.getTotalPoints() : 0;
        int totalPoints = basePoints + zvanjePoints;
        // Threshold to pass is half the total points plus 1
        return (totalPoints / 2) + 1;
    }    

    public static int calculateGamePoints(Team team, ZvanjeResult zvanjeWin) {
        int zvanjePoints = (zvanjeWin != null && zvanjeWin.getWinningTeam() == team) ? zvanjeWin.getTotalPoints() : 0;
        return team.getSmalls() + zvanjePoints;
    }

}
