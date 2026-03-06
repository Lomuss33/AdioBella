//                      ___
//  o__       o__     |   |\
// /|         /\      |   |X\
// / > o       <\     |   |XX\

package models;

import java.util.ArrayList;
import java.util.List;

public class Team {
    private String name;
    private List<Card> wonCards;
    private int bigs; // big score / current score in game
    public int smalls; // small score / points won in the current round

    public Team(String teamName) {
        this.name = teamName;
        this.wonCards = new ArrayList<>();
        this.bigs = 0; // Initialize big score
        this.smalls = 0; // Initialize small score
    }

    // Add the cards won in the current round to the team's won cards
    public void addWonCardsAsPoints(List<Card> addedCards) {
        wonCards.addAll(addedCards);
        for (Card card : addedCards) {
            smalls += card.getValue(); // Add card values to smalls
        }
    }

    public List<Player> getPlayers(List<Player> allPlayers) {
        List<Player> teamPlayers = new ArrayList<>();
        for (Player player : allPlayers) {
            if (player.getTeam() == this) {
                teamPlayers.add(player);
            }
        }
        return teamPlayers;
        
    }

    public List<Card> getWonCards() {
        return wonCards;
    }

    public void resetWonCards() {
        wonCards = new ArrayList<>();
    }

    public void setName(String nameToSet) {
        this.name = nameToSet;
    }

    public String getName() {
        return name;
    }

    // Update the bigs score
    public void addBigs(int points) {
        System.out.println("Adding " + points + " points to " + name + " big score");
        this.bigs += points;
    }

    public void setBigs(int points) {
        this.bigs = points;
    }

    public int getBigs() {
        return bigs;
    }

    public void addSmalls(int points) {
        System.out.println("Adding " + points + " points to " + name + " small score");
        this.smalls += points;
    }

    public void setSmalls(int points) {
        this.smalls = points;
    }

    // Reset the smalls score
    public void resetSmalls() {
        this.smalls = 0;
    }

    public int getSmalls() {
        return smalls;
    }
}
