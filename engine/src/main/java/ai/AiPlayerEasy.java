// ░░░░░░░░░░░░░░░░░
// ░░░░░░▄██▄░░░░░░░
// ░░░░▄██████▄░░░░░
// ░░░███▄██▄███░░░░
// ░░░░░▄▀▄▄▀▄░░░░░░
// ░░░░▀░▀░░▀░▀░░░░░
// ░░░░░░░░░░░░░░░░░
//
// EASY AI PLAYER
//

package ai;

import java.util.*;
import models.*;

public class AiPlayerEasy extends Player {

    public AiPlayerEasy(String name, Team team) {
        super(name, team);
    }

    // Randomly choose a card to play
    @Override
    public int chooseCardToPlay(List<Integer> playableIndexes) {
        if (playableIndexes.isEmpty()) {
            throw new IllegalArgumentException("No playable cards available!");
        }
        Random random = new Random();
        return playableIndexes.get(random.nextInt(playableIndexes.size())); // Pick a random card
    }

    // Randomly choose a trump suit
    // 1 - SPADES, 2 - HEARTS, 3 - DIAMONDS, 4 - CLUBS, 5 - SKIP
    @Override
    public TrumpChoice chooseTrumpOrSkip(int turnForChoosingTrump) {
        Random random = new Random();
    
        // If it's the 3rd turn, must choose (no skip)
        if (turnForChoosingTrump == 3) {
            Player.TrumpChoice[] nonSkipChoices = Arrays.stream(Player.TrumpChoice.values())
                .filter(choice -> choice != Player.TrumpChoice.SKIP)
                .toArray(Player.TrumpChoice[]::new);
            return nonSkipChoices[random.nextInt(nonSkipChoices.length)];
        }
    
        // Otherwise, 50% skip, 50% random suit
        if (random.nextBoolean()) {
            return Player.TrumpChoice.SKIP;
        } else {
            Player.TrumpChoice[] nonSkipChoices = Arrays.stream(Player.TrumpChoice.values())
                .filter(choice -> choice != Player.TrumpChoice.SKIP)
                .toArray(Player.TrumpChoice[]::new);
            return nonSkipChoices[random.nextInt(nonSkipChoices.length)];
        }
    }
    

    // Return an empty list for Zvanje (no detection logic)
    @Override
    public List<Card> callZvanje(List<Integer> selectedIndices) {
        System.out.println(name + " does not know how to detect Zvanje.");
        return new ArrayList<>(); // Always returns an empty list
    }
}
