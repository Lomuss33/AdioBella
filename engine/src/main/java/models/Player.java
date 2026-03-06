
//   ___...
// / ,-(_`;
// \ )_  _;
// (\[_][_])
//  |  L  |  
//  | \-_/ 
//
// PLAYER
//

package models;

import java.util.List;

// IDEA: maybe create a unique hashcode for backtracing the hand of the player
public abstract class Player {
    
    protected String name;
    protected Hand hand;
    protected List<Integer> playableIndices; 
    protected Team team;
    protected boolean waiting;

    public static enum TrumpChoice {
        SKIP(null), // No corresponding suit for SKIP
        SPADES(Card.Suit.SPADES),
        HEARTS(Card.Suit.HEARTS),
        DIAMONDS(Card.Suit.DIAMONDS),
        CLUBS(Card.Suit.CLUBS);

        private final Card.Suit suit;

        private TrumpChoice(Card.Suit suit) {
            this.suit = suit;
        }

        public Card.Suit getSuit() {
            return suit;
        }
    }

    public Player(String name, Team team) {
        this.name = name;
        this.team = team;
        this.hand = new Hand();
        this.waiting = false;
    }

    // Abstract method to choose trump
    public abstract TrumpChoice chooseTrumpOrSkip(int turnForChoosingTrump);

    // Abstract method to call zvanje
    public abstract List<Card> callZvanje(List<Integer> selectedIndices);
    
    // Abstract method to choose a card to be played
    public abstract int chooseCardToPlay(List<Integer> playableIndices);

    public final Card playCard(int index) {
        if (index < 0 || index >= hand.getCards().size()) {
            throw new IllegalArgumentException("Invalid card index.");
        }
        Card card = hand.getCard(index);
        hand.removeCard(index);
        return card;
    }

    // Get the name of the player
    public String getName() {
        return name;
    }

    // Get the hand of the player
    public Hand getHand() {
        return hand;
    }

    // Set the team of the player
    public Team getTeam() {
        return team;
    }

    public boolean isWaiting() {
        return waiting;
    }

    public void setWaiting(boolean decisionMade) {
        this.waiting = decisionMade;
    }

    public void setPlayableIndices(List<Integer> playableIndices) {
        this.playableIndices = playableIndices;
    }

    public List<Integer> getPlayableIndices() {
        return playableIndices;
    }

    // Display the hand of the player
    public void displayHand() {
        System.out.println();
        System.out.println(name + "'s Hand:");
        List<Card> cards = hand.getCards();
        for (int i = 0; i < cards.size(); i++) {
            System.out.println(i + " : " + cards.get(i));
        }
    }
}
