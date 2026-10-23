import type { PlayedCardView } from "../types";
import { trickCardStrength } from "./trickRules";

/** Predict the winner from the cards currently on the table, in play order. */
export function trickLeader(cards: readonly PlayedCardView[], trumpSuit: string | null): PlayedCardView | undefined {
  const leadSuit = cards[0]?.card.suit;
  if (!leadSuit) return undefined;
  const strength = ({ card }: PlayedCardView) => {
    if (!card.rank || !card.suit) return -1;
    return trickCardStrength({ rank: card.rank, suit: card.suit }, leadSuit, trumpSuit);
  };
  return cards.reduce((winner, play) => strength(play) > strength(winner) ? play : winner);
}
