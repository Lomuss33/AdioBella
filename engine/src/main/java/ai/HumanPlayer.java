// ⠀⠀⠀⠀⣀⣤⣴⣶⣶⣶⣦⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⣠⣾⣿⣿⣿⣿⣿⣿⢿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⢀⣾⣿⣿⣿⣿⣿⣿⣿⣅⢀⣽⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠀⠀
// ⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⣿⣿⣿⣿⣿⣿⣿⣿⣿⠛⠁⠀⠀⣴⣶⡄⠀⣶⣶⡄⠀⣴⣶⡄
// ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⣀⠀⠙⠋⠁⠀⠉⠋⠁⠀⠙⠋⠀
// ⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠈⠙⠿⣿⣿⣿⣿⣿⣿⣿⠿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠀⠀⠀⠀⠉⠉⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
// 
// HUMAN PLAYER 
//

package ai;

import java.util.*;
import models.*;

public class HumanPlayer extends Player {

    private TrumpChoice trumpChoice = null; // Variable to store the trump suit choice
    private int cardIndexChoice = -1; // Variable to store the card choice

    public HumanPlayer(String name, Team team) {
        super(name, team);
    }

    public TrumpChoice getTrumpChoice() {
        return trumpChoice;
    }

    public int getCardIndexChoice() {
        return cardIndexChoice;
    }

    // Choose a card index to play
    @Override
    public int chooseCardToPlay(List<Integer> playableIndexes) {
            if (cardIndexChoice == -1) { // Keep waiting until a valid choice is made
                    return -1; // No choice made yet
                }
            int chosenCardIndex = trumpChoice.ordinal(); // Use the ordinal value as the chosen card index
            cardIndexChoice = -1; // Reset for the next round
            return chosenCardIndex; // Return the chosen index to the game
    }

    // Get selected cards from index to go check Zvanje
    @Override
    public List<Card> callZvanje(List<Integer> selectedIndices) {
        List<Card> selectedCards = new ArrayList<>();
        for(int index : selectedIndices) {
            selectedCards.add(hand.getCard(index));
        }
        return selectedCards;
    }
    
    // Choose trump suit
    @Override
    public TrumpChoice chooseTrumpOrSkip(int turnForChoosingTrump) {
            if (trumpChoice == null) { // Keep waiting until a valid choice is made
                    if (turnForChoosingTrump == 3) {
                        System.out.println("CANT SKIP");
                    }
                    return null; // No choice made yet
            }
            TrumpChoice result = trumpChoice; // Save the chosen suit to return
            trumpChoice = null; // Reset for the next game
            return result; // Return the choice to the game
    }

    // Method called when trump input arrives
    public void trumpChoice(int choice) {
        trumpChoice = switch (choice) {
            case 1 -> Player.TrumpChoice.SPADES;
            case 2 -> Player.TrumpChoice.HEARTS;
            case 3 -> Player.TrumpChoice.DIAMONDS;
            case 4 -> Player.TrumpChoice.CLUBS;
            case 0 -> Player.TrumpChoice.SKIP;
            default -> throw new IllegalArgumentException("Invalid trump choice.");
        }; // Update the trump choice
    }

    // Method called when card input arrives
    public void cardChoice(int choice) {
        // Check if the index is valid
        if (choice < 0 || choice >= hand.getSize()) {
            throw new IllegalArgumentException("Invalid card choice.");
        }
        cardIndexChoice = choice; // Update the card choice
    }

}