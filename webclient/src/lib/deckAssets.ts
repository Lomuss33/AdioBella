import type { CardStyle } from "./preferences";
import type { CardView, Rank, Suit } from "../types";

const rankFiles: Record<Rank, string> = {
  SEVEN: "7", EIGHT: "8", NINE: "9", TEN: "10",
  JACK: "J", QUEEN: "Q", KING: "K", ACE: "A"
};
const fourColorRankFiles: Record<Rank, string> = {
  SEVEN: "7", EIGHT: "8", NINE: "9", TEN: "T",
  JACK: "J", QUEEN: "Q", KING: "K", ACE: "A"
};
const suitFiles: Record<Suit, string> = {
  CLUBS: "CLUBS", DIAMONDS: "DIAMONDS", HEARTS: "HEARTS", SPADES: "SPADES"
};
const suitInitials: Record<Suit, string> = { CLUBS: "C", DIAMONDS: "D", HEARTS: "H", SPADES: "S" };
const fourColorSuitFiles: Record<Suit, string> = { CLUBS: "c", DIAMONDS: "d", HEARTS: "h", SPADES: "s" };
const cardSuits = new Set<string>(Object.keys(suitFiles));

function basePath() {
  return `${import.meta.env.BASE_URL}assets/decks`;
}

export function deckCardAsset(deck: CardStyle, card: Pick<CardView, "rank" | "suit" | "faceUp">) {
  if (deck === "original") return null;
  if (!card.faceUp) {
    const backDeck = deck === "italian" ? "modern" : deck;
    return `${basePath()}/${backDeck}/back.svg`;
  }
  if (!card.rank || !card.suit) return null;
  const rank = rankFiles[card.rank as Rank];
  const suitValue = card.suit;
  if (!rank || !suitValue || !cardSuits.has(suitValue)) return null;
  const suit = suitValue as Suit;
  if (deck === "italian") return `${basePath()}/italian/${suitFiles[suit]}-${rank}.png`;
  if (deck === "german") return `${basePath()}/german/${suit}-${rank}.svg`;
  if (deck === "four-color") return `${basePath()}/four-color/${fourColorRankFiles[card.rank as Rank]}${fourColorSuitFiles[suit]}.svg`;
  if (deck === "heritage") return `${basePath()}/heritage/${suitInitials[suit]}-${rank}.svg`;
  return `${basePath()}/${deck}/${suitInitials[suit]}-${rank}.svg`;
}
