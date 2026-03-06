package ai;

import java.util.*;
import models.*;

public class AiPlayerNormal extends Player {

    public AiPlayerNormal(String name, Team team) {
        super(name, team);
    }

    // Randomly choose a card to play from playable cards
    @Override
    public int chooseCardToPlay(List<Integer> playableIndexes) {
        if (playableIndexes.isEmpty()) {
            throw new IllegalArgumentException("No playable cards available!");
        }
        Random random = new Random();
        return playableIndexes.get(random.nextInt(playableIndexes.size()));
    }

    // Choose Zvanje cards
    @Override
    public List<Card> callZvanje(List<Integer> selectedIndices) {
        return new ArrayList<>(); // Keep this basic for easy AI
    }

    // Choose the trump suit based on the most valuable cards in hand
    @Override
    public TrumpChoice chooseTrumpOrSkip(int turnForChoosingTrump) {
        Map<Card.Suit, Integer> suitStrengths = new HashMap<>();
    
        // Calculate the total strength of each suit as if it were the trump suit
        for (Card card : hand.getCards()) {
            Card.Suit suit = card.getSuit();
            suitStrengths.put(
                suit,
                suitStrengths.getOrDefault(suit, 0) + card.getStrength(suit, null) // Treat `suit` as the trump suit
            );
        }
    
        // Find the suit with the highest total strength
        Card.Suit strongestSuit = suitStrengths.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse(null);
    
        // If turnForChoosingTrump is 3, MUST choose a suit
        if (turnForChoosingTrump == 3) {
            if (strongestSuit == null) {
                // Fallback to the first available suit if no valid strong suit is found
                strongestSuit = suitStrengths.keySet().stream().findFirst().orElse(null);
            }
            if (strongestSuit != null) {
                System.out.println(name + " is forced to choose " + strongestSuit);
                return Player.TrumpChoice.valueOf(strongestSuit.name());
            }
        }
    
        // If no strong suit is found or its strength is <= 30, skip trump selection
        if (strongestSuit == null || suitStrengths.get(strongestSuit) <= 30) {
            System.out.println(name + " chooses to skip.");
            return Player.TrumpChoice.SKIP;
        }
    
        // Return the trump choice corresponding to the strongest suit
        System.out.println(name + " chooses " + strongestSuit);
        return Player.TrumpChoice.valueOf(strongestSuit.name());
    }
    
    


    // Group cards by suit
    private Map<Card.Suit, List<Card>> groupBySuit(List<Card> cards) {
        Map<Card.Suit, List<Card>> groupedBySuit = new HashMap<>();
        for (Card card : cards) {
            groupedBySuit.computeIfAbsent(card.getSuit(), k -> new ArrayList<>()).add(card);
        }
        return groupedBySuit;
    }
}

