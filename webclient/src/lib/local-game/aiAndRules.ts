import type { Difficulty, Rank, Suit, TrumpChoice } from "../../types";
import { trickCardStrength as cardStrength } from "../trickRules";
import type { Card, PlayedCard, PlayerState, TeamSide } from "./meldService";
import { RANKS, SUITS } from "./meldService";
import type { RandomSource } from "./random";

export const suitSymbols: Record<Suit, string> = {
  SPADES: "S",
  HEARTS: "H",
  DIAMONDS: "D",
  CLUBS: "C"
};

export const suitDisplayNames: Record<Suit, string> = {
  SPADES: "Spades",
  HEARTS: "Hearts",
  DIAMONDS: "Diamonds",
  CLUBS: "Clubs"
};

export const rankSymbols: Record<Rank, string> = {
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  TEN: "10",
  JACK: "J",
  QUEEN: "Q",
  KING: "K",
  ACE: "A"
};

export function createShuffledDeck(random: RandomSource): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(index + 1);
    const current = deck[index];
    deck[index] = deck[swapIndex];
    deck[swapIndex] = current;
  }

  return deck;
}

export function compareCards(left: Card, right: Card) {
  const suitCompare = SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit);
  if (suitCompare !== 0) {
    return suitCompare;
  }
  return RANKS.indexOf(left.rank) - RANKS.indexOf(right.rank);
}

export function cardLabel(card: Card) {
  return `${rankSymbols[card.rank]}${suitSymbols[card.suit]}`;
}

export function cardPoints(card: Card, trumpSuit: Suit | null) {
  const trump = card.suit === trumpSuit;
  switch (card.rank) {
    case "SEVEN":
    case "EIGHT":
      return 0;
    case "NINE":
      return trump ? 14 : 0;
    case "JACK":
      return trump ? 20 : 2;
    case "QUEEN":
      return 3;
    case "KING":
      return 4;
    case "TEN":
      return 10;
    case "ACE":
      return 11;
  }
}

export function trumpSelectionScore(card: Card, candidateTrump: Suit) {
  // Keep bidding weights independent of the trick comparison tier.
  const strength = cardStrength(card, candidateTrump, candidateTrump) - (card.suit === candidateTrump ? 100 : 0);
  const base = cardPoints(card, candidateTrump) + strength;
  if (card.suit === candidateTrump && card.rank === "JACK") {
    return base + 30;
  }
  if (card.suit === candidateTrump && card.rank === "NINE") {
    return base + 20;
  }
  if (card.suit !== candidateTrump && card.rank === "ACE") {
    return base + 8;
  }
  return base;
}

export function leadSuit(trick: PlayedCard[]): Suit | null {
  return trick.length === 0 ? null : trick[0].card.suit;
}

export function legalCardIndices(player: PlayerState, trick: PlayedCard[], trumpSuit: Suit | null): number[] {
  if (trick.length === 0) {
    return indexRange(player.hand.length);
  }

  const currentLeadSuit = trick[0].card.suit;
  const leadSuitCards = indexesForSuit(player.hand, currentLeadSuit);
  if (leadSuitCards.length > 0) {
    if (currentLeadSuit === trumpSuit) {
      const overTrump = higherTrumpCards(player.hand, trick, trumpSuit);
      return overTrump.length === 0 ? leadSuitCards : overTrump;
    }
    return leadSuitCards;
  }

  const currentWinner = findWinningPlay(trick, trumpSuit);
  const partnerWinning = currentWinner != null && player.team.side === teamSideForPlayer(currentWinner.playerIndex);
  const trumpCards = indexesForSuit(player.hand, trumpSuit);
  if (partnerWinning || trumpCards.length === 0) {
    return indexRange(player.hand.length);
  }

  const overTrump = higherTrumpCards(player.hand, trick, trumpSuit);
  return overTrump.length === 0 ? trumpCards : overTrump;
}

export function findWinningPlay(trick: PlayedCard[], trumpSuit: Suit | null): PlayedCard | null {
  if (trick.length === 0) {
    return null;
  }

  const currentLeadSuit = leadSuit(trick);
  return trick.reduce((winner, play) =>
    cardStrength(play.card, currentLeadSuit, trumpSuit) > cardStrength(winner.card, currentLeadSuit, trumpSuit) ? play : winner
  );
}

export function cardWins(challenger: Card, currentWinner: Card, currentLeadSuit: Suit | null, trumpSuit: Suit | null) {
  return cardStrength(challenger, currentLeadSuit, trumpSuit) > cardStrength(currentWinner, currentLeadSuit, trumpSuit);
}

export function higherTrumpCards(hand: Card[], trick: PlayedCard[], trumpSuit: Suit | null): number[] {
  if (!trumpSuit) {
    return [];
  }

  const currentWinner = findWinningPlay(trick, trumpSuit);
  if (!currentWinner || currentWinner.card.suit !== trumpSuit) {
    return indexesForSuit(hand, trumpSuit);
  }

  return indexRange(hand.length)
    .filter((index) => hand[index].suit === trumpSuit)
    .filter((index) => cardStrength(hand[index], trumpSuit, trumpSuit) > cardStrength(currentWinner.card, trumpSuit, trumpSuit));
}

export function belaEligibleCardIndices(player: PlayerState, trumpSuit: Suit | null): number[] {
  return indexRange(player.hand.length).filter((index) => isBelaEligible(player, index, trumpSuit));
}

export function isBelaEligible(player: PlayerState, handIndex: number, trumpSuit: Suit | null): boolean {
  if (player.belaResolved || !trumpSuit || handIndex < 0 || handIndex >= player.hand.length) {
    return false;
  }

  const card = player.hand[handIndex];
  if (card.suit !== trumpSuit || (card.rank !== "QUEEN" && card.rank !== "KING")) {
    return false;
  }

  const partnerRank: Rank = card.rank === "QUEEN" ? "KING" : "QUEEN";
  return player.hand.some((candidate, index) => index !== handIndex && candidate.suit === trumpSuit && candidate.rank === partnerRank);
}

export function chooseCardForAi(
  player: PlayerState,
  legalIndices: number[],
  trick: PlayedCard[],
  trumpSuit: Suit | null,
  difficulty: Difficulty,
  random: RandomSource
): number {
  switch (difficulty) {
    case "EASY":
      return legalIndices[random.nextInt(legalIndices.length)];
    case "HARD":
      return chooseHardCard(player, legalIndices, trick, trumpSuit);
    case "NORMAL":
    default:
      return chooseNormalCard(player, legalIndices, trick, trumpSuit);
  }
}

export function chooseNormalCard(player: PlayerState, legalIndices: number[], trick: PlayedCard[], trumpSuit: Suit | null): number {
  const currentWinner = findWinningPlay(trick, trumpSuit);
  const currentLeadSuit = leadSuit(trick);
  return [...legalIndices].sort((leftIndex, rightIndex) => {
    const leftCard = player.hand[leftIndex];
    const rightCard = player.hand[rightIndex];
    const leftWins = !currentWinner || cardWins(leftCard, currentWinner.card, currentLeadSuit, trumpSuit);
    const rightWins = !currentWinner || cardWins(rightCard, currentWinner.card, currentLeadSuit, trumpSuit);
    const leftScore = leftWins ? cardPoints(leftCard, trumpSuit) : 100 + cardPoints(leftCard, trumpSuit);
    const rightScore = rightWins ? cardPoints(rightCard, trumpSuit) : 100 + cardPoints(rightCard, trumpSuit);
    return leftScore - rightScore;
  })[0];
}

export function chooseHardCard(player: PlayerState, legalIndices: number[], trick: PlayedCard[], trumpSuit: Suit | null): number {
  const currentWinner = findWinningPlay(trick, trumpSuit);
  const currentLeadSuit = leadSuit(trick);
  const winningCards = legalIndices.filter(
    (index) => !currentWinner || cardWins(player.hand[index], currentWinner.card, currentLeadSuit, trumpSuit)
  );

  if (winningCards.length > 0) {
    return [...winningCards].sort(
      (leftIndex, rightIndex) =>
        cardStrength(player.hand[leftIndex], currentLeadSuit, trumpSuit) -
        cardStrength(player.hand[rightIndex], currentLeadSuit, trumpSuit)
    )[0];
  }

  return [...legalIndices].sort(
    (leftIndex, rightIndex) => cardPoints(player.hand[leftIndex], trumpSuit) - cardPoints(player.hand[rightIndex], trumpSuit)
  )[0];
}

export function chooseTrumpForAi(player: PlayerState, forced: boolean, difficulty: Difficulty): TrumpChoice {
  let bestChoice: TrumpChoice = "SKIP";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const suit of SUITS) {
    const score = player.hand.reduce((sum, card) => sum + trumpSelectionScore(card, suit), 0);
    if (score > bestScore) {
      bestScore = score;
      bestChoice = suit;
    }
  }

  const threshold = difficulty === "EASY" ? 42 : difficulty === "HARD" ? 32 : 36;
  return forced || bestScore >= threshold ? bestChoice : "SKIP";
}

function indexesForSuit(hand: Card[], suit: Suit | null) {
  if (!suit) {
    return [];
  }

  const indexes: number[] = [];
  for (let index = 0; index < hand.length; index += 1) {
    if (hand[index].suit === suit) {
      indexes.push(index);
    }
  }
  return indexes;
}

function indexRange(size: number) {
  return Array.from({ length: size }, (_, index) => index);
}

function teamSideForPlayer(playerIndex: number): TeamSide {
  return playerIndex % 2 === 0 ? "YOURS" : "ENEMIES";
}
