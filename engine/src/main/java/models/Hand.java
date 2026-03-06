//
//     _______
// ---'   ____)____
//           ______)
//           _______)
//          _______)
// ---.__________)
//
// HAND
//

package models;

import java.util.ArrayList;
import java.util.List;
import services.CardUtils;

public class Hand {

    private List<Card> cards;

    // Constructor initializes an empty hand
    public Hand() {
        cards = new ArrayList<>();
    }

    public int getSize() {
        return cards.size();
    }

    // Add cards to the hand
    public void addCards(List<Card> newCards) {
        cards.addAll(newCards);
    }

    public void addCard(Card newCard) {
        cards.add(newCard);
    }

    // Get the current all cards in the hand
    public List<Card> getCards() {
        return new ArrayList<>(cards); // Return a copy of current hand
    }

    // Get a single card by index
    public final Card getCard(int index) {
        return cards.get(index);
    }

    // Remove a single card from the hand by index
    public void removeCard(int index) {
        cards.remove(index);
    }

    public void setCards(List<Card> newCards) {
        cards = new ArrayList<>(newCards);
    }

        // New method to sort the internal cards
    public void sortCards() {
        CardUtils.sortBySuitAndRank(cards);
    }

    // Check if the hand is empty / used for testing
    public boolean isEmpty() {
        return cards.isEmpty();
    }

    // Display the hand as a string
    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("Hand: \n");
        for (Card card : cards) {
            sb.append(card).append("\n");
        }
        return sb.toString();
    }
}