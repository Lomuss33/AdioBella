// ░░░░░░░░░░░░░░░░░
// ░░░░▄▄████▄▄░░░░░
// ░░░██████████░░░░
// ░░░██▄▄██▄▄██░░░░
// ░░░░▄▀▄▀▀▄▀▄░░░░░
// ░░░▀░░░░░░░░▀░░░░
// ░░░░░░░░░░░░░░░░░
//
// NORMAL AI PLAYER
//

package ai;

import java.util.*;
import models.*;

public class AiPlayerPRO extends Player {

    public AiPlayerPRO(String name, Team team) {
        super(name, team);
    }

    // Choose the best card to play based on strategy
    @Override
    public int chooseCardToPlay(List<Integer> playableIndexes, List<Card> onFloor, Card.Suit trump) {
        if (playableIndexes.isEmpty()) {
            throw new IllegalArgumentException("No playable cards available!");
        }
        // Initialize variables for the best choice
        int bestIndex = playableIndexes.get(0);
        int bestStrength = Integer.MIN_VALUE;
    
        // Determine the leading suit on the floor (if any cards have been played)
        Card.Suit leadSuit = onFloor.isEmpty() ? null : onFloor.get(0).getSuit();
    
        // Loop through all playable cards
        for (int index : playableIndexes) {
            Card card = hand.getCard(index); // Get the card corresponding to the index
            int strength = card.getStrength(trump, leadSuit); // Calculate the card strength
    
            // Select the card with the highest strength
            if (strength > bestStrength) {
                bestStrength = strength;
                bestIndex = index;
            }
        }
        return bestIndex; // Return the index of the best card to play
    }

    // Choose the trump suit based on the best scoring mechanism
    // chooseTrumpOrSkip 
    @Override
    public TrumpChoice chooseTrumpOrSkip(int turnForChoosingTrump) {
        Map<Card.Suit, Integer> suitScores = new HashMap<>();
        Card.Suit bestSuit = evaluateHandForTrump(suitScores);

        // If turnForChoosingTrump is 3, MUST choose a suit
        if (turnForChoosingTrump == 3) {
            if (bestSuit == null) {
                // Choose the suit with the highest score if no JACK and NINE combo
                bestSuit = suitScores.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);
            }
            if (bestSuit != null) {
                System.out.println(name + " is forced to choose " + bestSuit);
                return Player.TrumpChoice.valueOf(bestSuit.name());
            }
        }

        // Skip unless there is a valid JACK and NINE combo
        if (bestSuit == null) {
            System.out.println(name + " chooses to skip.");
            return Player.TrumpChoice.SKIP;
        }

        // Return the trump choice corresponding to the best suit
        System.out.println(name + " chooses " + bestSuit);
        return Player.TrumpChoice.valueOf(bestSuit.name());
    }

    // Evaluate the hand to find the best trump suit
    private Card.Suit evaluateHandForTrump(Map<Card.Suit, Integer> suitScores) {
        boolean hasJackAndNineCombo = false;
        Card.Suit bestSuit = null;

        // Evaluate hand to find potential trump suits
        for (Card card : hand.getCards()) {
            Card.Suit suit = card.getSuit();

            // Update suit scores, excluding EIGHT and SEVEN cards for final selection
            if (card.getRank() != Card.Rank.EIGHT && card.getRank() != Card.Rank.SEVEN) {
                int score = card.getStrength(suit, null); // Calculate strength assuming this suit as trump
                suitScores.put(suit, suitScores.getOrDefault(suit, 0) + score);
            }

            // Check if the suit contains both JACK and NINE
            boolean hasJack = hand.getCards().stream().anyMatch(c -> c.getSuit() == suit && c.getRank() == Card.Rank.JACK);
            boolean hasNine = hand.getCards().stream().anyMatch(c -> c.getSuit() == suit && c.getRank() == Card.Rank.NINE);

            if (hasJack && hasNine) {
                long supportingCards = hand.getCards().stream()
                    .filter(c -> (c.getSuit() == suit && c.getRank() != Card.Rank.JACK && c.getRank() != Card.Rank.NINE) || 
                                 (c.getRank() == Card.Rank.ACE && c.getSuit() != suit))
                    .count();

                if (supportingCards >= 2) {
                    hasJackAndNineCombo = true;
                    bestSuit = suit;
                }
            }
        }

        return hasJackAndNineCombo ? bestSuit : null;
    }
    // chooseTrumpOrSkip

}