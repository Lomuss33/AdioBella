package models;

import java.util.List;
import services.ZvanjeService.ZvanjeResult;

public class CurrentState {
    private final Team team1, team2;
    private final ZvanjeResult zvanjeWin;
    private final int winTreshold;
    private final Card.Suit trumpSuit;
    private final Card.Suit leadSuit;
    private final int dealerIndex;
    private final int startingPlayerIndex;
    private final List<Card> onFloorCards;
    private final List<Player> players;

    // Constructor for the start of the GAME (after Zvanje)
    public CurrentState(Team team1, Team team2, List<Player> players, ZvanjeResult zvanjeWin, int winTreshold, int dealerIndex) {
        this.team1 = team1;
        this.team2 = team2;
        this.players = players;
        this.zvanjeWin = zvanjeWin;
        this.winTreshold = winTreshold;
        this.dealerIndex = dealerIndex;
        this.trumpSuit = null;
        this.leadSuit = null;
        this.startingPlayerIndex = -1;
        this.onFloorCards = null;
    }

    // Constructor for mid-GAME state (used by advanced AI)
    public CurrentState(Team team1, Team team2, List<Player> players, ZvanjeResult zvanjeWin, int winTreshold, int dealerIndex, 
                        Card.Suit trumpSuit, Card.Suit leadSuit, int startingPlayerIndex, List<Card> onFloorCards) {
        this.team1 = team1;
        this.team2 = team2;
        this.players = players;
        this.zvanjeWin = zvanjeWin;
        this.winTreshold = winTreshold;
        this.dealerIndex = dealerIndex;
        this.trumpSuit = trumpSuit;
        this.leadSuit = leadSuit;
        this.startingPlayerIndex = startingPlayerIndex;
        this.onFloorCards = onFloorCards;
    }

    // Constructor for the ROUND (used by simple AI)
    public CurrentState(List<Card> onFloorCards, Card.Suit trumpSuit, Team team1, Team team2, int startingPlayerIndex) {
        this.team1 = team1;
        this.team2 = team2;
        this.onFloorCards = onFloorCards;
        this.trumpSuit = trumpSuit;
        this.startingPlayerIndex = startingPlayerIndex;
        this.zvanjeWin = null;
        this.winTreshold = 0;
        this.dealerIndex = -1;
        this.leadSuit = null;
        this.players = null;
    }

    // Getters for all attributes
    public Team getTeam1() {
        return team1;
    }

    public Team getTeam2() {
        return team2;
    }

    public ZvanjeResult getZvanjeWin() {
        return zvanjeWin;
    }

    public int getWinTreshold() {
        return winTreshold;
    }

    public Card.Suit getTrumpSuit() {
        return trumpSuit;
    }

    public Card.Suit getLeadSuit() {
        return leadSuit;
    }

    public int getDealerIndex() {
        return dealerIndex;
    }

    public int getStartingPlayerIndex() {
        return startingPlayerIndex;
    }

    public List<Card> getOnFloorCards() {
        return onFloorCards;
    }

    public List<Player> getPlayers() {
        return players;
    }
}
