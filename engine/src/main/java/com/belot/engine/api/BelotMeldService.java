package com.belot.engine.api;

import com.belot.engine.api.BelotMatchFacade.Card;
import com.belot.engine.api.BelotMatchFacade.MeldCombination;
import com.belot.engine.api.BelotMatchFacade.MeldSet;
import com.belot.engine.api.BelotMatchFacade.MeldWinner;
import com.belot.engine.api.BelotMatchFacade.PlayerState;
import com.belot.engine.api.BelotMatchFacade.Rank;
import com.belot.engine.api.BelotMatchFacade.Suit;
import com.belot.engine.api.BelotMatchFacade.TeamSide;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

final class BelotMeldService {

    private BelotMeldService() {
    }

    static MeldSet evaluate(PlayerState player, Suit trumpSuit) {
        List<MeldCombination> candidates = new ArrayList<>();
        candidates.addAll(fourOfKindCandidates(player.hand));
        candidates.addAll(sequenceCandidates(player.hand));

        BestSelection bestSelection = chooseBestNonOverlapping(candidates, 0, new HashSet<>(), new ArrayList<>(), 0, 0, null);
        return new MeldSet(player, List.copyOf(bestSelection.melds()), bestSelection.totalPoints(), bestSelection.strongestComparisonValue());
    }

    static MeldWinner determineWinningMeldWinner(
            List<MeldSet> declaredMeldSets,
            TeamSide declarer,
            Function<TeamSide, String> teamNameResolver
    ) {
        List<MeldSet> yourSets = declaredMeldSets.stream()
                .filter(meldSet -> meldSet.player().team.side == TeamSide.YOURS)
                .toList();
        List<MeldSet> enemySets = declaredMeldSets.stream()
                .filter(meldSet -> meldSet.player().team.side == TeamSide.ENEMIES)
                .toList();

        int yourHighest = yourSets.stream().mapToInt(MeldSet::strongestComparisonValue).max().orElse(0);
        int enemyHighest = enemySets.stream().mapToInt(MeldSet::strongestComparisonValue).max().orElse(0);
        if (yourHighest == 0 && enemyHighest == 0) {
            return null;
        }

        TeamSide winningTeam;
        if (yourHighest > enemyHighest) {
            winningTeam = TeamSide.YOURS;
        } else if (enemyHighest > yourHighest) {
            winningTeam = TeamSide.ENEMIES;
        } else {
            winningTeam = declarer;
        }

        if (winningTeam == null) {
            return null;
        }

        List<MeldSet> winningSets = winningTeam == TeamSide.YOURS ? yourSets : enemySets;
        return new MeldWinner(
                winningTeam,
                teamNameResolver.apply(winningTeam),
                winningSets,
                winningSets.stream().mapToInt(MeldSet::totalPoints).sum()
        );
    }

    private static List<MeldCombination> fourOfKindCandidates(List<Card> hand) {
        List<MeldCombination> combinations = new ArrayList<>();
        Map<Rank, List<Card>> byRank = hand.stream().collect(Collectors.groupingBy(Card::rank));
        for (Map.Entry<Rank, List<Card>> entry : byRank.entrySet()) {
            Rank rank = entry.getKey();
            if (entry.getValue().size() != 4 || rank == Rank.SEVEN || rank == Rank.EIGHT) {
                continue;
            }

            int points = rank == Rank.JACK ? 200 : rank == Rank.NINE ? 150 : 100;
            int comparisonValue = rank == Rank.JACK ? 700 + rank.ordinal() : rank == Rank.NINE ? 650 + rank.ordinal() : 600 + rank.ordinal();
            String label = rank == Rank.JACK ? "Four Jacks" : rank == Rank.NINE ? "Four Nines" : "Four of a Kind";
            combinations.add(new MeldCombination("FOUR_OF_A_KIND", label, points, comparisonValue, List.copyOf(entry.getValue())));
        }
        return combinations;
    }

    private static List<MeldCombination> sequenceCandidates(List<Card> hand) {
        List<MeldCombination> combinations = new ArrayList<>();
        Map<Suit, List<Card>> bySuit = hand.stream().collect(Collectors.groupingBy(Card::suit));
        for (Map.Entry<Suit, List<Card>> entry : bySuit.entrySet()) {
            List<Card> cards = new ArrayList<>(entry.getValue());
            cards.sort(Comparator.comparingInt(card -> card.rank().ordinal()));

            for (int start = 0; start < cards.size(); start++) {
                List<Card> run = new ArrayList<>();
                run.add(cards.get(start));
                for (int index = start + 1; index < cards.size(); index++) {
                    Card previous = cards.get(index - 1);
                    Card current = cards.get(index);
                    if (current.rank().ordinal() != previous.rank().ordinal() + 1) {
                        break;
                    }
                    run.add(current);
                    if (run.size() >= 3) {
                        combinations.add(sequenceCombination(run));
                    }
                }
            }
        }
        return combinations;
    }

    private static MeldCombination sequenceCombination(List<Card> run) {
        Card highest = run.get(run.size() - 1);
        int points = run.size() >= 5 ? 100 : run.size() == 4 ? 50 : 20;
        int comparisonValue = run.size() >= 5 ? 500 + highest.rank().ordinal() : run.size() == 4 ? 450 + highest.rank().ordinal() : 400 + highest.rank().ordinal();
        String label = "Sequence of " + run.size();
        return new MeldCombination("SEQUENCE", label, points, comparisonValue, List.copyOf(run));
    }

    private static BestSelection chooseBestNonOverlapping(
            List<MeldCombination> candidates,
            int index,
            Set<String> usedCards,
            List<MeldCombination> chosen,
            int totalPoints,
            int strongestComparisonValue,
            BestSelection best
    ) {
        BestSelection currentBest = best;
        if (index >= candidates.size()) {
            BestSelection candidate = new BestSelection(List.copyOf(chosen), totalPoints, strongestComparisonValue);
            if (currentBest == null || candidate.beats(currentBest)) {
                return candidate;
            }
            return currentBest;
        }

        currentBest = chooseBestNonOverlapping(candidates, index + 1, usedCards, chosen, totalPoints, strongestComparisonValue, currentBest);
        MeldCombination combination = candidates.get(index);
        if (combination.cards().stream().map(BelotMeldService::cardKey).noneMatch(usedCards::contains)) {
            List<String> addedKeys = combination.cards().stream().map(BelotMeldService::cardKey).toList();
            usedCards.addAll(addedKeys);
            chosen.add(combination);
            currentBest = chooseBestNonOverlapping(
                    candidates,
                    index + 1,
                    usedCards,
                    chosen,
                    totalPoints + combination.points(),
                    Math.max(strongestComparisonValue, combination.comparisonValue()),
                    currentBest
            );
            chosen.remove(chosen.size() - 1);
            usedCards.removeAll(addedKeys);
        }
        return currentBest;
    }

    private static String cardKey(Card card) {
        return card.suit().name() + ":" + card.rank().name();
    }

    private record BestSelection(List<MeldCombination> melds, int totalPoints, int strongestComparisonValue) {
        private boolean beats(BestSelection other) {
            if (totalPoints != other.totalPoints()) {
                return totalPoints > other.totalPoints();
            }
            if (strongestComparisonValue != other.strongestComparisonValue()) {
                return strongestComparisonValue > other.strongestComparisonValue();
            }
            return melds.size() < other.melds.size();
        }
    }
}
