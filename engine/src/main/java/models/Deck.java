// _____
// |A .  | _____
// | /.\ ||A ^  | _____
// |(_._)|| / \ ||A _  | _____
// |  |  || \ / || ( ) ||A_ _ |
// |____V||  .  ||(_'_)||( v )|
//        |____V||  |  || \ / |
//               |____V||  .  |
//                      |____V|
//
// DECK
//

package models;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class Deck implements Cloneable {

    private List<Card> cards; // List of cards in the deck

    // Constructor for deck with all cards
    public Deck() {
        initializeDeck(); // Use helper method to initialize cards
        shuffle(); // Randomize the deck
    }

    // Clone method for the Deck (deep clone)
    @Override
    public Deck clone() throws CloneNotSupportedException {
        Deck clonedDeck = (Deck) super.clone(); // Shallow copy
        // Deep clone the list of cards
        clonedDeck.cards = new ArrayList<>();
        for (Card card : this.cards) { 
            clonedDeck.cards.add(card.clone()); // Clone each card
        }
        return clonedDeck;
    }

    // Private helper to initialize all cards in the deck
    public void initializeDeck() {
        cards = new ArrayList<>();
        for (Card.Suit suit : Card.Suit.values()) {
            for (Card.Rank rank : Card.Rank.values()) {
                cards.add(new Card(suit, rank));
            }
        }
        shuffle(); // Shuffle to randomize card order
    }

    // Shuffle to randomize card order
    public final void shuffle() {
        Collections.shuffle(cards);
    }

    // Deal specified count of cards directly to a player
    public void dealHand(Player player, int count) {
        for (int i = 0; i < count; i++) {
            if (cards.isEmpty()) {
                throw new IllegalArgumentException("Not enough cards left to deal.");
            }
            player.getHand().addCard(cards.remove(0));
        }
    }

    // Deal cards to all players
    public void dealAllHands(List<Player> players, int cardsPerPlayer) {
        for (Player player : players) {
            dealHand(player, cardsPerPlayer); // Directly deal cards to the player
        }
    }

    // Reset the deck to its full initial state
    public void reset() {
        initializeDeck(); // Use helper method to initialize cards
        shuffle(); // Randomize the deck
    }

    // Set the state of the deck (undo functionality)
    public void setCards(List<Card> newCards) {
        this.cards = new ArrayList<>(newCards); // Set the deck to the new state
    }

    // Get the current state of the deck
    public List<Card> getCards() {
        return new ArrayList<>(cards);  // Return a copy for immutability
    }

    // For debugging - to display the deck contents
    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("Deck: \n");
        for (Card card : cards) {
            sb.append(card).append("\n");
        }
        return sb.toString();
    }
}