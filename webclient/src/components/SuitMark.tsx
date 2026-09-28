export type CardSuit = "CLUBS" | "DIAMONDS" | "HEARTS" | "SPADES";

const marks: Record<CardSuit, string> = {
  CLUBS: "\u2663",
  DIAMONDS: "\u2666",
  HEARTS: "\u2665",
  SPADES: "\u2660"
};

export function SuitMark({ suit, className = "" }: { suit: CardSuit; className?: string }) {
  return <span className={`deck-suit-mark ${className}`} aria-hidden="true">{marks[suit]}</span>;
}
