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

public class AiPlayerHard extends Player {

    public AiPlayerHard(String name, Team team) {
        super(name, team);
    }

    // Choose the best card to play based on strategy
    @Override
    public int chooseCardToPlay(List<Integer> playableIndexes) {
        if (playableIndexes.isEmpty()) {
            throw new IllegalArgumentException("No playable cards available!");
        }

        // Group playable cards
        List<Card> playableCards = new ArrayList<>();
        for (int index : playableIndexes) {
            playableCards.add(hand.getCard(index));
        }

        // Find the weakest card that can win
        Card bestCard = playableCards.stream()
            .filter(card -> canWin(card)) // Filter cards that can win
            .min(Comparator.comparingInt(Card::getValue)) // Choose the weakest winning card
            .orElse(null);

        // If no winning card exists, play the lowest card
        if (bestCard == null) {
            return playableIndexes.stream()
                .min(Comparator.comparingInt(index -> hand.getCard(index).getValue()))
                .orElse(playableIndexes.get(0));
        }

        return playableIndexes.get(hand.getCards().indexOf(bestCard));
    }

    // Determine if the card can win the current round
    private boolean canWin(Card card) {
        // Implement logic to compare the card against the strongest card on the floor
        // Use trumpSuit, leadSuit, and other contextual variables
        return true; // Placeholder for actual logic
    }

    // Choose the trump suit based on the best scoring mechanism
    @Override
    public TrumpChoice chooseTrumpOrSkip(int turnForChoosingTrump) {
        Map<Card.Suit, Integer> suitScores = new HashMap<>();
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
        if (!hasJackAndNineCombo) {
            System.out.println(name + " chooses to skip.");
            return Player.TrumpChoice.SKIP;
        }
    
        // Return the trump choice corresponding to the best suit
        System.out.println(name + " chooses " + bestSuit);
        return Player.TrumpChoice.valueOf(bestSuit.name());
    }

    // Call Zvanje by detecting high-value combinations
    @Override
    public List<Card> callZvanje(List<Integer> selectedIndices) {
        Map<Card.Rank, List<Card>> groupedByRank = groupByRank(hand.getCards());
        Map<Card.Suit, List<Card>> groupedBySuit = groupBySuit(hand.getCards());

        List<Card> zvanjeCards = new ArrayList<>();
        detectFourOfAKind(groupedByRank, zvanjeCards);
        detectSequences(groupedBySuit, zvanjeCards);

        return zvanjeCards;
    }

    // Group cards by rank
    private Map<Card.Rank, List<Card>> groupByRank(List<Card> cards) {
        Map<Card.Rank, List<Card>> groupedByRank = new HashMap<>();
        for (Card card : cards) {
            groupedByRank.computeIfAbsent(card.getRank(), k -> new ArrayList<>()).add(card);
        }
        return groupedByRank;
    }

    // Group cards by suit
    private Map<Card.Suit, List<Card>> groupBySuit(List<Card> cards) {
        Map<Card.Suit, List<Card>> groupedBySuit = new HashMap<>();
        for (Card card : cards) {
            groupedBySuit.computeIfAbsent(card.getSuit(), k -> new ArrayList<>()).add(card);
        }
        return groupedBySuit;
    }

    // Detect four-of-a-kind combinations
    private void detectFourOfAKind(Map<Card.Rank, List<Card>> groupedByRank, List<Card> zvanjeCards) {
        for (List<Card> cards : groupedByRank.values()) {
            if (cards.size() == 4) {
                zvanjeCards.addAll(cards);
            }
        }
    }

    // Detect sequences
    private void detectSequences(Map<Card.Suit, List<Card>> groupedBySuit, List<Card> zvanjeCards) {
        for (List<Card> cards : groupedBySuit.values()) {
            cards.sort(Comparator.comparing(card -> card.getRank().ordinal()));
            // Implement sequence detection logic here
        }
    }
}