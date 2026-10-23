import type { CardView, Rank } from "../types";

const plainStrength: Record<Rank, number> = {
  SEVEN: 5, EIGHT: 10, NINE: 15, JACK: 20, QUEEN: 30, KING: 40, TEN: 50, ACE: 60
};
const trumpStrength: Record<Rank, number> = {
  SEVEN: 10, EIGHT: 20, QUEEN: 30, KING: 40, TEN: 50, ACE: 60, NINE: 70, JACK: 80
};

/** Disjoint strength ranges: every trump beats every card in the led suit. */
export function trickCardStrength(card: Pick<CardView, "rank" | "suit">, leadSuit: string | null, trumpSuit: string | null): number {
  if (!card.rank || !card.suit || !(card.rank in plainStrength)) return -1;
  const rank = card.rank as Rank;
  if (card.suit === trumpSuit) return 100 + trumpStrength[rank];
  return card.suit === leadSuit ? plainStrength[rank] : 0;
}
