package com.belot.engine.api;

import com.belot.engine.api.BelotMatchFacade.Card;
import com.belot.engine.api.BelotMatchFacade.PlayedCard;
import com.belot.engine.api.BelotMatchFacade.PlayerState;
import com.belot.engine.api.BelotMatchFacade.Rank;
import com.belot.engine.api.BelotMatchFacade.Suit;
import com.belot.engine.api.BelotMatchFacade.TeamSide;
import com.belot.engine.api.BelotMatchFacade.TrickState;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

final class BelotAiAndRules {

    private BelotAiAndRules() {
    }

    static List<Card> createShuffledDeck(Random random) {
        List<Card> deck = new ArrayList<>();
        for (Suit suit : Suit.values()) {
            for (Rank rank : Rank.values()) {
                deck.add(new Card(suit, rank));
            }
        }
        Collections.shuffle(deck, random);
        return deck;
    }

    static List<Integer> legalCardIndices(List<Card> hand, List<PlayedCard> trick, Suit trumpSuit, TeamSide teamSide) {
        if (trick.isEmpty()) {
            return indexRange(hand.size());
        }

        Suit leadSuit = trick.get(0).card().suit();
        List<Integer> leadSuitCards = indexesForSuit(hand, leadSuit);
        if (!leadSuitCards.isEmpty()) {
            if (leadSuit == trumpSuit) {
                List<Integer> overTrump = higherTrumpCards(hand, trick, trumpSuit);
                return overTrump.isEmpty() ? leadSuitCards : overTrump;
            }
            return leadSuitCards;
        }

        PlayedCard currentWinner = findWinningPlay(trick, trumpSuit);
        boolean partnerWinning = currentWinner != null && teamSide == teamSideForPlayer(currentWinner.playerIndex());
        List<Integer> trumpCards = indexesForSuit(hand, trumpSuit);
        if (partnerWinning || trumpCards.isEmpty()) {
            return indexRange(hand.size());
        }

        List<Integer> overTrump = higherTrumpCards(hand, trick, trumpSuit);
        return overTrump.isEmpty() ? trumpCards : overTrump;
    }

    static PlayedCard findWinningPlay(List<PlayedCard> trick, Suit trumpSuit) {
        if (trick.isEmpty()) {
            return null;
        }
        Suit leadSuit = trick.get(0).card().suit();
        return trick.stream()
                .max(Comparator.comparingInt(play -> play.card().strength(leadSuit, trumpSuit)))
                .orElse(trick.get(0));
    }

    static boolean cardWins(Card challenger, Card currentWinner, Suit leadSuit, Suit trumpSuit) {
        return challenger.strength(leadSuit, trumpSuit) > currentWinner.strength(leadSuit, trumpSuit);
    }

    static List<Integer> higherTrumpCards(List<Card> hand, List<PlayedCard> trick, Suit trumpSuit) {
        PlayedCard currentWinner = findWinningPlay(trick, trumpSuit);
        if (currentWinner == null || currentWinner.card().suit() != trumpSuit) {
            return indexesForSuit(hand, trumpSuit);
        }

        return indexRange(hand.size()).stream()
                .filter(index -> hand.get(index).suit() == trumpSuit)
                .filter(index -> hand.get(index).strength(trumpSuit, trumpSuit)
                        > currentWinner.card().strength(trumpSuit, trumpSuit))
                .toList();
    }

    static List<Integer> belaEligibleCardIndices(PlayerState player, Suit trumpSuit) {
        List<Integer> eligible = new ArrayList<>();
        for (int index = 0; index < player.hand.size(); index++) {
            if (isBelaEligible(player, index, trumpSuit)) {
                eligible.add(index);
            }
        }
        return eligible;
    }

    static boolean isBelaEligible(PlayerState player, int handIndex, Suit trumpSuit) {
        if (player.belaResolved || trumpSuit == null || handIndex < 0 || handIndex >= player.hand.size()) {
            return false;
        }

        Card card = player.hand.get(handIndex);
        if (card.suit() != trumpSuit || (card.rank() != Rank.QUEEN && card.rank() != Rank.KING)) {
            return false;
        }

        Rank partnerRank = card.rank() == Rank.QUEEN ? Rank.KING : Rank.QUEEN;
        for (int index = 0; index < player.hand.size(); index++) {
            if (index == handIndex) {
                continue;
            }
            Card candidate = player.hand.get(index);
            if (candidate.suit() == trumpSuit && candidate.rank() == partnerRank) {
                return true;
            }
        }
        return false;
    }

    static int chooseCardForAi(
            PlayerState player,
            List<Integer> legalIndices,
            TrickState currentTrick,
            Suit trumpSuit,
            Difficulty difficulty,
            Random random
    ) {
        return switch (difficulty) {
            case EASY -> legalIndices.get(random.nextInt(legalIndices.size()));
            case NORMAL -> chooseNormalCard(player, legalIndices, currentTrick, trumpSuit);
            case HARD -> chooseHardCard(player, legalIndices, currentTrick, trumpSuit);
        };
    }

    static int chooseNormalCard(PlayerState player, List<Integer> legalIndices, TrickState currentTrick, Suit trumpSuit) {
        PlayedCard currentWinner = findWinningPlay(currentTrick.cards, trumpSuit);
        Suit leadSuit = currentTrick.leadSuit();
        return legalIndices.stream()
                .min(Comparator.comparingInt(index -> {
                    Card card = player.hand.get(index);
                    boolean wins = currentWinner == null || cardWins(card, currentWinner.card(), leadSuit, trumpSuit);
                    return wins ? card.points(trumpSuit) : 100 + card.points(trumpSuit);
                }))
                .orElse(legalIndices.get(0));
    }

    static int chooseHardCard(PlayerState player, List<Integer> legalIndices, TrickState currentTrick, Suit trumpSuit) {
        PlayedCard currentWinner = findWinningPlay(currentTrick.cards, trumpSuit);
        Suit leadSuit = currentTrick.leadSuit();
        List<Integer> winningCards = legalIndices.stream()
                .filter(index -> currentWinner == null
                        || cardWins(player.hand.get(index), currentWinner.card(), leadSuit, trumpSuit))
                .toList();

        if (!winningCards.isEmpty()) {
            return winningCards.stream()
                    .min(Comparator.comparingInt(index -> player.hand.get(index).strength(leadSuit, trumpSuit)))
                    .orElse(winningCards.get(0));
        }

        return legalIndices.stream()
                .min(Comparator.comparingInt(index -> player.hand.get(index).points(trumpSuit)))
                .orElse(legalIndices.get(0));
    }

    static TrumpChoice chooseTrumpForAi(PlayerState player, boolean forced, Difficulty difficulty) {
        TrumpChoice bestChoice = TrumpChoice.SKIP;
        int bestScore = Integer.MIN_VALUE;

        for (Suit suit : Suit.values()) {
            int score = player.hand.stream().mapToInt(card -> card.trumpSelectionScore(suit)).sum();
            if (score > bestScore) {
                bestScore = score;
                bestChoice = TrumpChoice.valueOf(suit.name());
            }
        }

        int threshold = switch (difficulty) {
            case EASY -> 42;
            case NORMAL -> 36;
            case HARD -> 32;
        };

        return forced || bestScore >= threshold ? bestChoice : TrumpChoice.SKIP;
    }

    private static List<Integer> indexesForSuit(List<Card> hand, Suit suit) {
        List<Integer> indexes = new ArrayList<>();
        for (int index = 0; index < hand.size(); index++) {
            if (hand.get(index).suit() == suit) {
                indexes.add(index);
            }
        }
        return indexes;
    }

    private static List<Integer> indexRange(int size) {
        List<Integer> indexes = new ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            indexes.add(index);
        }
        return indexes;
    }

    private static TeamSide teamSideForPlayer(int playerIndex) {
        return playerIndex % 2 == 0 ? TeamSide.YOURS : TeamSide.ENEMIES;
    }
}
