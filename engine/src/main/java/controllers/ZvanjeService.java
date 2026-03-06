

package controllers;




import java.util.*;
import java.util.stream.Collectors;
import models.*;;

public class ZvanjeService {

    public enum ZvanjeType {
        FOUR_JACKS(200), FOUR_NINES(150), FOUR_OTHERS(100), SEQUENCE_OF_3(20),
        SEQUENCE_OF_4(50), SEQUENCE_OF_5_OR_MORE(100), BELOT(1001), BELA(20);

        private final int points;

        ZvanjeType(int points) {
            this.points = points;
        }

        public int getPoints() {
            return points;
        }
    }

    public static class ZvanjeResult implements Cloneable {

        private List<ZvanjeType> zvanjeTypes;
        private List<Card> cardsOfZvanje;
        private ZvanjeType biggestZvanje;
        private Player player;
        private int totalPoints;

        public ZvanjeResult(Player player, List<ZvanjeType> zvanjeTypes, int totalPoints, ZvanjeType biggestZvanje, List<Card> cardsOfZvanje) {
            this.player = player;
            this.zvanjeTypes = new ArrayList<>(zvanjeTypes);
            this.totalPoints = totalPoints;
            this.biggestZvanje = biggestZvanje;
            this.cardsOfZvanje = new ArrayList<>(cardsOfZvanje);;
        }

        public List<Card> getCardsOfZvanje() {
            return cardsOfZvanje;
        }
        
        public List<ZvanjeType> getZvanjeTypes() {
            return zvanjeTypes;
        }
    
        public ZvanjeType getBiggestZvanje() {
            return biggestZvanje;
        }

        public int getTotalPoints() {
            return totalPoints;
        }
    
        public Player getPlayer() {
            return player;
        }

        public Team getZvanjeTeam() {
            return player.getTeam();
        }

        public void setPoints(int points) {
            this.totalPoints = points;
        }

        public void setPlayer(Player player) {
            this.player = player;
        }

        @Override
        public ZvanjeResult clone() throws CloneNotSupportedException { 
            try {
                // Shallow clone ZvanjeResult
                ZvanjeResult cloned = (ZvanjeResult) super.clone();
    
                // Use the *same* Player instance from the original ZvanjeResult
                cloned.player = this.player; // No deep cloning occurs here
    
                // Use mutable deep clones for cards and ZvanjeTypes
                cloned.cardsOfZvanje = new ArrayList<>();
                for (Card card : this.cardsOfZvanje) {
                    cloned.cardsOfZvanje.add(card.clone()); // Assuming Card implements Cloneable
                }
    
                cloned.zvanjeTypes = new ArrayList<>(this.zvanjeTypes); // Enum values don’t need deep cloning
    
                // Copy primitive values
                cloned.totalPoints = this.totalPoints;
                cloned.biggestZvanje = this.biggestZvanje;
    
                return cloned;
    
            } catch (CloneNotSupportedException e) {
                // This should never happen since Cloneable is implemented 
                throw new AssertionError("Unexpected CloneNotSupportedException", e);
            }
        }

    }

    public static ZvanjeResult biggestZvanje(List<ZvanjeResult> results) {
        if (results == null || results.isEmpty()) {
            return null; // No results
        }
        // Find the maximum Zvanje points
        int maxPoints = results.stream()
            .filter(result -> result.getBiggestZvanje() != null) // Ignore players with no Zvanje
            .mapToInt(ZvanjeResult::getTotalPoints)
            .max()
            .orElse(0); // Default to 0 if no Zvanje is found
    
        // Filter results with the maximum points
        List<ZvanjeResult> topResults = results.stream()
            .filter(result -> result.getTotalPoints() == maxPoints)
            .collect(Collectors.toList());
    
        // Choose the result closest to dealer (who got their result first)
        return topResults.get(0);
    }

    // detectPlayerZvanje
    // Detect all Zvanje types for a player
    public static ZvanjeResult detectPlayerZvanje(Player player, Card.Suit trumpSuit) {
        if (player == null || player.getHand() == null || player.getHand().getCards().isEmpty()) {
            return new ZvanjeResult(player, Collections.emptyList(), 0, null, Collections.emptyList());
        }
        List<Card> cards = player.getHand().getCards();
        List<ZvanjeType> detectedZvanjeTypes = new ArrayList<>();
        Map<ZvanjeType, List<Card>> cardsUsedForZvanjeMap = new HashMap<>(); // New map to track cards used for Zvanje
        // Detect four-of-a-kind Zvanje
        detectFourOfAKind(groupByRank(cards), detectedZvanjeTypes, cardsUsedForZvanjeMap);
        // Detect sequences
        groupBySuit(cards).values().forEach(suitCards ->
            detectSequences(suitCards, detectedZvanjeTypes, cardsUsedForZvanjeMap)
        );
        // Detect special combinations like BELA
        detectBela(cards, trumpSuit, detectedZvanjeTypes, cardsUsedForZvanjeMap);
        // Combine all cards used for Zvanje
        List<Card> cardsUsedForZvanje = cardsUsedForZvanjeMap.values()
            .stream()
            .flatMap(Collection::stream)
            .distinct()
            .collect(Collectors.toList());
        // Calculate total points and determine the biggest Zvanje
        int totalPoints = detectedZvanjeTypes.stream()
            .mapToInt(ZvanjeType::getPoints)
            .sum();
        ZvanjeType biggestZvanje = detectedZvanjeTypes.stream()
            .max(Comparator.comparingInt(ZvanjeType::getPoints))
            .orElse(null);
        return new ZvanjeResult(player, detectedZvanjeTypes, totalPoints, biggestZvanje, cardsUsedForZvanje);
    }
    // detectPlayerZvanje
    
    // Group cards by rank
    private static Map<Card.Rank, List<Card>> groupByRank(List<Card> cards) {
        return cards.stream().collect(Collectors.groupingBy(Card::getRank));
    }

    // Group cards by suit
    private static Map<Card.Suit, List<Card>> groupBySuit(List<Card> cards) {
        return cards.stream().collect(Collectors.groupingBy(Card::getSuit));
    }

    private static void detectFourOfAKind(Map<Card.Rank, List<Card>> rankGroups, List<ZvanjeType> zvanjeTypes, Map<ZvanjeType, List<Card>> cardsUsedForZvanjeMap) {
        rankGroups.forEach((rank, groupedCards) -> {
            if (groupedCards.size() == 4) {
                ZvanjeType zvanje = switch (rank) {
                    case JACK -> ZvanjeType.FOUR_JACKS;
                    case NINE -> ZvanjeType.FOUR_NINES;
                    case EIGHT, SEVEN -> null; // Skip these cases
                    default -> ZvanjeType.FOUR_OTHERS;
                };
                if (zvanje != null) {
                    zvanjeTypes.add(zvanje);
                    cardsUsedForZvanjeMap.put(zvanje, new ArrayList<>(groupedCards)); // Track these cards
                }
            }
        });
    }
    
    

    private static void detectSequences(List<Card> suitCards, List<ZvanjeType> zvanjeTypes, Map<ZvanjeType, List<Card>> cardsUsedForZvanjeMap) {
        suitCards.sort(Comparator.comparingInt(card -> card.getRank().ordinal()));
    
        List<Card> currentSequence = new ArrayList<>();
    
        for (Card card : suitCards) {
            if (!currentSequence.isEmpty() &&
                    card.getRank().ordinal() != currentSequence.get(currentSequence.size() - 1).getRank().ordinal() + 1) {
                evaluateSequence(currentSequence, zvanjeTypes, cardsUsedForZvanjeMap);
                currentSequence.clear();
            }
            currentSequence.add(card);
        }
        evaluateSequence(currentSequence, zvanjeTypes, cardsUsedForZvanjeMap);
    }
    
    private static void evaluateSequence(List<Card> sequence, List<ZvanjeType> zvanjeTypes, Map<ZvanjeType, List<Card>> cardsUsedForZvanjeMap) {
        int size = sequence.size();
        if (size >= 3) {
            ZvanjeType zvanje = switch (size) {
                case 8 -> ZvanjeType.BELOT;
                case 5, 6, 7 -> ZvanjeType.SEQUENCE_OF_5_OR_MORE;
                case 4 -> ZvanjeType.SEQUENCE_OF_4;
                case 3 -> ZvanjeType.SEQUENCE_OF_3;
                default -> null;
            };
            if (zvanje != null) {
                zvanjeTypes.add(zvanje);
                cardsUsedForZvanjeMap.put(zvanje, new ArrayList<>(sequence)); // Track this sequence
            }
        }
    }

    private static void detectBela(List<Card> cards, Card.Suit trumpSuit, List<ZvanjeType> zvanjeTypes, Map<ZvanjeType, List<Card>> cardsUsedForZvanjeMap) {
        List<Card> belaCards = cards.stream()
            .filter(card -> card.getSuit() == trumpSuit &&
                    (card.getRank() == Card.Rank.KING || card.getRank() == Card.Rank.QUEEN))
            .toList();
        if (belaCards.size() == 2) {
            zvanjeTypes.add(ZvanjeType.BELA);
            cardsUsedForZvanjeMap.put(ZvanjeType.BELA, belaCards); // Track BELA cards
        }
    }
    
}
