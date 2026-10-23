import type { PlayedCardView } from "../types";

// Belot order differs from point value: trump nine and jack outrank the ace.
const plainOrder = ["SEVEN", "EIGHT", "NINE", "JACK", "QUEEN", "KING", "TEN", "ACE"];
const trumpOrder = ["SEVEN", "EIGHT", "QUEEN", "KING", "TEN", "ACE", "NINE", "JACK"];

/** Predict the winner from the cards currently on the table, in play order. */
export function trickLeader(cards: readonly PlayedCardView[], trumpSuit: string | null): PlayedCardView | undefined {
  const leadSuit = cards[0]?.card.suit;
  if (!leadSuit) return undefined;
  const strength = ({ card }: PlayedCardView) => {
    if (!card.rank || !card.suit) return -1;
    if (card.suit === trumpSuit) return 100 + trumpOrder.indexOf(card.rank);
    if (card.suit === leadSuit) return 10 + plainOrder.indexOf(card.rank);
    return 0;
  };
  return cards.reduce((winner, play) => strength(play) > strength(winner) ? play : winner);
}
