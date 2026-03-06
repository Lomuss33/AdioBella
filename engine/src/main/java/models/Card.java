// _____
// |A .  |
// | /.\ |
// |(_._)|
// |  |  |
// |____V|
//
// CARD
//

package models;
import models.Card;

public class Card {
    // Enum for the Suit of the card with string attribute
    public enum Suit {
        HEARTS("\u2665"), // ♥
        DIAMONDS("\u2666"), // ♦
        CLUBS("\u2663"), // ♣
        SPADES("\u2660"); // ♠

        private final String symbol;

        Suit(String symbol) {
            this.symbol = symbol;
        }

        public String getSymbol() {
            return symbol;
        }
    }

    // Enum for the Rank of the card
    public enum Rank {
        SEVEN("7"), EIGHT("8"),
        NINE("9"), TEN("10"),
        JACK("J"), QUEEN("Q"),
        KING("K"), ACE("A");

        private final String symbol;

        Rank(String symbol) {
            this.symbol = symbol;
        }

        public String getSymbol() {
            return symbol;
        }
    }

    private final Suit suit; // Suit of the card
    private final Rank rank; // Rank of the card
    private int value; // Value of the card

    // Constructor // e.g. 9♥ (Value: 14) => Card card = new Card(Suit.HEARTS, Rank.NINE)
    public Card(Suit suit, Rank rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = 0; // Value based on trump or non-trump
    }

    public int getStrength(Card.Suit trumpSuit, Card.Suit leadSuit) {
        if (this.getSuit() == trumpSuit) {
            // Strength for Trump Cards
            return switch (this.getRank()) {
                case JACK -> 16; // Strongest
                case NINE -> 15;
                case ACE -> 14;
                case KING -> 13;
                case QUEEN -> 12;
                case TEN -> 11;
                case EIGHT -> 10;
                case SEVEN -> 9; // Weakest
            };
        } else if (this.getSuit() == leadSuit) {
            // Strength for Non-Trump Cards
            return switch (this.getRank()) {
                case ACE -> 8; // Strongest
                case KING -> 7;
                case QUEEN -> 6;
                case JACK -> 5;
                case TEN -> 4;
                case NINE -> 3;
                case EIGHT -> 2;
                case SEVEN -> 1; // Weakest
            };
        }
        return 0; // If the card is not of trump or lead suit
    }

    // Set the value of the card based on whether it's a trump card
    public void calculateValue(Suit trumpSuit) {
        boolean isTrump = this.suit == trumpSuit;
        switch (this.rank) {
            case SEVEN -> value = 0;
            case EIGHT -> value = 0;
            case NINE -> value = isTrump ? 14 : 0;
            case TEN -> value = 10;
            case JACK -> value = isTrump ? 20 : 2;
            case QUEEN -> value = 3;
            case KING -> value = 4;
            case ACE -> value = 11;
        }
    }

    // Getter Suit
    public Suit getSuit() {
        return suit; 
    }

    public String printSuit() {
        switch (suit) {
            case HEARTS: return "♥";
            case DIAMONDS: return "♦";
            case CLUBS: return "♣";
            case SPADES: return "♠";
            default: return "";
        }
    }

    // Getter Rank
    public Rank getRank() {
        return rank;
    }

    // ERROR default?
    public String printRank() {
        switch (rank) {
            case SEVEN: return "7";
            case EIGHT: return "8";
            case NINE: return "9";
            case TEN: return "10";
            case JACK: return "J";
            case QUEEN: return "Q";
            case KING: return "K";
            case ACE: return "A";
            default: return "";
        }
    }

    // Getter Value
    public int getValue() {
        return value;
    }

    // public String printSuit() {
    //     return suit.getSymbol();
    // }

    // public String printRank() {
    //     return rank.getSymbol();
    // }

    // ToString method for debugging
    @Override
    public String toString() {
        return printRank() + printSuit();
    }
}