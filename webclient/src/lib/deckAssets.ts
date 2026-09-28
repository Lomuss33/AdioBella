import type { CardStyle } from "./preferences";
import type { CardView } from "../types";

type CardRank = "SEVEN" | "EIGHT" | "NINE" | "TEN" | "JACK" | "QUEEN" | "KING" | "ACE";
type CardSuit = "CLUBS" | "DIAMONDS" | "HEARTS" | "SPADES";

const rankFiles: Record<CardRank, string> = {
  SEVEN: "7", EIGHT: "8", NINE: "9", TEN: "10",
  JACK: "J", QUEEN: "Q", KING: "K", ACE: "A"
};
const fourColorRankFiles: Record<CardRank, string> = {
  SEVEN: "7", EIGHT: "8", NINE: "9", TEN: "T",
  JACK: "J", QUEEN: "Q", KING: "K", ACE: "A"
};
const suitFiles: Record<CardSuit, string> = {
  CLUBS: "CLUBS", DIAMONDS: "DIAMONDS", HEARTS: "HEARTS", SPADES: "SPADES"
};
const suitInitials: Record<CardSuit, string> = { CLUBS: "C", DIAMONDS: "D", HEARTS: "H", SPADES: "S" };
const fourColorSuitFiles: Record<CardSuit, string> = { CLUBS: "c", DIAMONDS: "d", HEARTS: "h", SPADES: "s" };
const cardSuits = new Set<string>(Object.keys(suitFiles));

function basePath() {
  return `${import.meta.env.BASE_URL}assets/decks`;
}

export function deckCardAsset(deck: CardStyle, card: Pick<CardView, "rank" | "suit" | "faceUp">) {
  if (deck === "original") return null;
  if (!card.faceUp) return `${basePath()}/${deck}/back.svg`;
  if (!card.rank || !card.suit) return null;
  const rank = rankFiles[card.rank as CardRank];
  const suitValue = card.suit;
  if (!rank || !suitValue || !cardSuits.has(suitValue)) return null;
  const suit = suitValue as CardSuit;
  if (deck === "italian") return `${basePath()}/italian/${suitFiles[suit]}-${rank}.png`;
  if (deck === "german") return `${basePath()}/german/${suit}-${rank}.svg`;
  if (deck === "four-color") return `${basePath()}/four-color/${fourColorRankFiles[card.rank as CardRank]}${fourColorSuitFiles[suit]}.svg`;
  if (deck === "heritage") return `${basePath()}/heritage/${suitInitials[suit]}-${rank}.svg`;
  return `${basePath()}/${deck}/${suitInitials[suit]}-${rank}.svg`;
}
