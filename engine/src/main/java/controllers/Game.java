// ░░░░░░░▄█▄▄▄█▄
// ▄▀░░░░▄▌─▄─▄─▐▄░░░░▀▄
// █▄▄█░░▀▌─▀─▀─▐▀░░█▄▄█
// ░▐▌░░░░▀▀███▀▀░░░░▐▌
// ████░▄█████████▄░████


package controllers;

import ai.HumanPlayer;
import java.util.*;
import models.*;
import models.Player.TrumpChoice;
import services.*;
import services.ZvanjeService.ZvanjeResult;
import services.ZvanjeService.ZvanjeType;

public class Game {

    private final Team team1, team2;
    private final List<Player> players;
    public ZvanjeResult zvanjeWin;
    public int winTreshold;
    private final Deck deck;
    public Card.Suit trumpSuit;
    private final int dealerIndex;
    private int roundStarterIndex;
    private int roundCount;
    private boolean midRound;
    public Round currentRound;

    public enum Difficulty {
        EASY, NORMAL, HARD, TEST
    }

    public Game(List<Player> players, Team team1, Team team2, int dealerIndex) {
        this.players = players;
        this.team1 = team1;
        this.team2 = team2;
        this.deck = new Deck();
        this.zvanjeWin = null;
        this.dealerIndex = dealerIndex;    
        this.roundStarterIndex = (dealerIndex + 1) % 4; // Player next to the dealer starts    
        this.roundCount = 0;
        this.midRound = false;
        this.currentRound = null;
    }

    public Team lookForWinner() {
        // Check if a team has crossed the win threshold
        Team winner = GameUtils.findGameWinner(team1, team2, zvanjeWin, winTreshold);
        if (winner != null) {
            System.out.println("Game over! Winner: " + winner.getName()); 
        } else {
            System.out.println("Game continues. Current scores: " + team1.getName() + " - " + team1.getBigs() + ", " + team2.getName() + " - " + team2.getBigs());
        }
        return winner;
    }


    public void initializeGame() {
        // Shuffle the deck in front of players
        deck.initializeDeck();
        // Secure reset small points for both teams
        team1.resetSmalls();
        team2.resetSmalls();
        // Assert that the deck size is 32
        if (deck.getCards().size() != 32) {
            throw new IllegalStateException("Deck size must be 32 cards.");
        }
        // Deal 6 cards to players to choose trump suit
        deck.dealAllHands(players, 6);

        System.out.println(players.get(dealerIndex).getName() + " is the dealer.");
        System.out.println();
    }

    public boolean trumpSelection() {
        trumpSuit = chooseTrumpSuit(dealerIndex);
        if (trumpSuit != null) {
            System.out.println("Trump suit chosen: " + trumpSuit);
            // Reset decisionMade for all players
            for (Player player : players) {
                player.setWaiting(false);
            }
            return true;
        } else {
            System.out.println("YOU ARE NEXT!");
            return false;
        }
    }
    
    public void showZvanje() {
        System.out.println("ZVANJE:");
        // Sort all hands, deal last 2 cards and update card values
        updateCardValues(trumpSuit);
        deck.dealAllHands(players, 2);
        sortAllPlayersHands(players);        
        zvanjeWin = reportZvanje(trumpSuit, dealerIndex);
        winTreshold = GameUtils.calculateWinThreshold(zvanjeWin);
    }

    // Play 8 rounds and check for a winner after each round
    public boolean playRounds() {
        for (int i = roundCount; i < 8; i++) { // Resume from saved round count
            System.out.println("Round " + (i + 1));
            // Start a new round and get the winner's index
            System.out.println("Round starts: " + players.get(roundStarterIndex).getName());
            if (!midRound) currentRound = new Round(players, roundStarterIndex, trumpSuit); // Start a new round
            int winnerIndex = currentRound.playTurns(i); // Start the round and find its winner 
            if(winnerIndex == -1) {
                midRound = true; 
                return false; // If the round is not over, HumanPlayer is playing
            }
            roundStarterIndex = winnerIndex; // Winner starts the next round
            for(Player player : players) { // Reset all players' waiting status
            player.setWaiting(false);
            }
            roundCount++; // Increment the round count
        }

        awardGameVictory(); // Award points to the winning team
        roundCount = 0; // Reset round count for the next game

        return true; // End of all rounds 
    }

    public void awardGameVictory() {
        // Check if the dealer's team has crossed the win threshold
        Team dealerTeam = players.get(dealerIndex).getTeam();
        Team otherTeam = (dealerTeam == team1) ? team2 : team1;

        int dealerTeamPoints = GameUtils.calculateGamePoints(dealerTeam, zvanjeWin);
        int otherTeamPoints = GameUtils.calculateGamePoints(otherTeam, zvanjeWin);

        // Check if the dealer's team has crossed the win threshold
        if (dealerTeamPoints >= winTreshold) {
            dealerTeam.addBigs(dealerTeamPoints);
            otherTeam.addBigs(otherTeamPoints);
            System.out.println();
            System.out.println("Dealer's team PASSED!: " + dealerTeamPoints);
            System.out.println("Other team: " + otherTeamPoints);
        } else {
            // Award points to the other team
            otherTeam.addBigs(otherTeamPoints + dealerTeamPoints);
            System.out.println();
            System.out.println("Dealer's team did NOT PASS! Dealer's team: " + dealerTeam.getBigs());
            System.out.println("Other team GETS ALL: " + otherTeam.getBigs());
        }
    }

    private ZvanjeResult reportZvanje(Card.Suit trumpSuit, int dealerIndex) {
        List<ZvanjeResult> zvanjeResults = new ArrayList<>();
    
        int numPlayers = players.size();
        for (int i = 0; i < numPlayers; i++) {
            // Calculate the current player's index, starting from dealerIndex and wrapping around
            int currentIndex = (dealerIndex + i + 1) % numPlayers;
            Player player = players.get(currentIndex);

            ZvanjeResult result = ZvanjeService.detectPlayerZvanje(player, trumpSuit);
            zvanjeResults.add(result);

            // Print player's cards
            System.out.println();
            player.displayHand();
        }
        ////////////////////////////////////////////////////
        System.out.println();
        for (ZvanjeResult result : zvanjeResults) {
            System.out.println(result.getPlayer().getName() + "'s ZvanjeTypes: " + result.getZvanjeTypes());
        }
        System.out.println();
        // Find the player with the highest Zvanje
        ZvanjeResult winningZvanjeResult = ZvanjeService.biggestZvanje(zvanjeResults);
    
        // If no Zvanje is detected for any player, return null
        if (winningZvanjeResult == null) {

            System.out.println("No Zvanje detected for any player.");

            return null;
        }
    
        Player winningPlayer = winningZvanjeResult.getPlayer();
        Team winningTeam = winningPlayer.getTeam();
    
        // Calculate total points for the winning player's team
        int totalPoints = calculateTotalZvanjePoints(winningTeam, zvanjeResults);
        // Update the winning ZvanjeResult with the total points
        winningZvanjeResult.setPoints(totalPoints);


        // Print results
        if (winningZvanjeResult.getBiggestZvanje() != null) {
            System.out.println("Player with the highest Zvanje: " + winningPlayer.getName());
            System.out.println("Winning Team: " + winningTeam.getName());
            System.out.println("Total Zvanje Points: " + totalPoints);
            // Print ZvanjeTypes for the winning team
            System.out.println("Zvanje types of the winning team:");
            zvanjeResults.stream()
                    .filter(result -> result.getPlayer().getTeam() == winningTeam)
                    .flatMap(result -> result.getZvanjeTypes().stream())
                    .forEach(System.out::println);
        } else {
            System.out.println("No Zvanje detected for any player.");
        }
        System.out.println();
        return winningZvanjeResult;
    }
    
    // Method to calculate total Zvanje points for a given team
    private int calculateTotalZvanjePoints(Team team, List<ZvanjeResult> zvanjeResults) {
        // Filter ZvanjeResults for the given team and sum up the points
        return zvanjeResults.stream()
                .filter(result -> result.getPlayer().getTeam() == team)
                .flatMap(result -> result.getZvanjeTypes().stream())
                .mapToInt(ZvanjeType::getPoints)
                .sum();
    }

    // Method to update values for all cards in the deck and players' hands
    public void updateCardValues(Card.Suit trumpSuit) {
        // Update values for all cards in the deck
        for (Card card : deck.getCards()) {
            card.calculateValue(trumpSuit);
        }
        // Update values for all cards in players' hands
        for (Player player : players) {
            for (Card card : player.getHand().getCards()) {
                card.calculateValue(trumpSuit);
            }
        }
    }

    // Method to choose the trump suit by going around the table and forcing a choice if all players skip (Human com: trumpChoice(int choice))
    private Card.Suit chooseTrumpSuit(int dealerIndex) {
        int currentIndex  = (dealerIndex + 1) % players.size(); // Player next to the dealer
        TrumpChoice finalChoice = null;

        for (int i = 0; i < players.size(); i++) {
            Player currentPlayer = players.get(currentIndex);
            // Skip players who have already made a decision
            if(currentPlayer.isWaiting() && i != 3) {
                currentIndex = (currentIndex + 1) % players.size(); // Move to the next player
                continue;
            }
            System.out.println(currentPlayer.getName() + "'s turn to choose trump suit.");
            // Handle human player 
            if(currentPlayer instanceof HumanPlayer) {
                // System.out.println("""
                //     Choose Your Trump Suit Option:
                //     0. Skip Trump Selection
                //     1. Spades
                //     2. Hearts
                //     3. Diamonds
                //     4. Clubs
                //     -> Match.pickTrump(int choice)
                //     Please make your choice (0-4): 
                //     """);
                    // Wait for the human player to make a choice or return already made choice
                    TrumpChoice humanChoice  = ((HumanPlayer) currentPlayer).getTrumpChoice();

                    if (humanChoice != null) { // If the player has made a choice
                        currentPlayer.setWaiting(true);
                        if (humanChoice == TrumpChoice.SKIP) {
                            if (i == dealerIndex) { // If last player, return null
                                System.out.println(currentPlayer.getName() + " must pick!");
                                return null;
                            }
                            System.out.println(currentPlayer.getName() + " skipped.");
                            continue;
                        } else {
                            finalChoice = humanChoice; // Real trump choice
                            System.out.println(currentPlayer.getName() + " chose " + finalChoice);
                            break;
                        }        
                    } else {
                        return null; // Give the human player a chance to choose
                    }
                    // currentPlayer.setDecisionMade(true);
                    // return choice != null ? choice.getSuit() : null;
            }

            if (i == dealerIndex) {
                System.out.println(currentPlayer.getName() + " MUST choose a trump suit:");                
            }

            TrumpChoice playerChoice = currentPlayer.chooseTrumpOrSkip(i);
            currentPlayer.setWaiting(true);

            // Skip if the player chooses to skip
            if (playerChoice != TrumpChoice.SKIP) {
                finalChoice = playerChoice;
                System.out.println(currentPlayer.getName() + " chose " + finalChoice);
                break;
            } else {
                System.out.println(currentPlayer.getName() + " skipped.");
            }
            
            currentIndex = (currentIndex + 1) % players.size(); // Move to the next player
        }
        // After all players have made a choice, return the final choice
        return finalChoice != null ? finalChoice.getSuit() : null;
    }

    // Sort all players' hands by suit and rank
    public static void sortAllPlayersHands(List<Player> players) {
        for (Player player : players) {
            player.getHand().sortCards(); // Sort each player's hand in place
        }
    }


    public Team getTeam1() {
        return team1;
    }

    public Team getTeam2() {
        return team2;
    }

    public List<Player> getPlayers() {
        return players;
    }

    public ZvanjeResult getZvanjeWin() {
        return zvanjeWin;
    }

    public int getWinTreshold() {
        return winTreshold;
    }

    public Deck getDeck() {
        return deck;
    }

    public Card.Suit getTrumpSuit() {
        return trumpSuit;
    }

    public int getDealerIndex() {
        return dealerIndex;
    }
}
