import type { Rank, Suit } from "../../types";

export type TeamSide = "YOURS" | "ENEMIES";
export type Seat = "SOUTH" | "WEST" | "NORTH" | "EAST";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface PlayedCard {
  playerIndex: number;
  card: Card;
}

export interface TeamState {
  side: TeamSide;
  name: string;
  matchWins: number;
  gameScore: number;
  trickPoints: number;
  tricksWon: number;
  meldPoints: number;
}

export interface PlayerState {
  index: number;
  id: string;
  name: string;
  seat: Seat;
  human: boolean;
  team: TeamState;
  hand: Card[];
  belaCalled?: boolean;
  belaResolved?: boolean;
}

export interface TrickState {
  leadPlayerIndex: number;
  cards: PlayedCard[];
}

export interface MeldCombination {
  kind: string;
  label: string;
  points: number;
  comparisonValue: number;
  cards: Card[];
}

export interface MeldSet {
  player: PlayerState;
  melds: MeldCombination[];
  totalPoints: number;
  strongestComparisonValue: number;
}

export interface MeldWinner {
  team: TeamSide;
  teamName: string;
  players: MeldSet[];
  totalPoints: number;
}

export const SUITS: Suit[] = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];
export const RANKS: Rank[] = ["SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN", "KING", "ACE"];

export function evaluateMeldSet(player: PlayerState, _trumpSuit: Suit): MeldSet {
  const candidates = [...sameRankCandidates(player.hand), ...sequenceCandidates(player.hand)];
  const best = chooseBestNonOverlapping(candidates, 0, new Set<string>(), [], 0, 0, null);
  return {
    player,
    melds: best?.melds ?? [],
    totalPoints: best?.totalPoints ?? 0,
    strongestComparisonValue: best?.strongestComparisonValue ?? 0
  };
}

export function determineWinningMeldWinner(
  declaredMeldSets: MeldSet[],
  declarer: TeamSide | null,
  teamNameFor: (side: TeamSide) => string
): MeldWinner | null {
  const yourSets = declaredMeldSets.filter((meldSet) => meldSet.player.team.side === "YOURS");
  const enemySets = declaredMeldSets.filter((meldSet) => meldSet.player.team.side === "ENEMIES");
  const yourHighest = Math.max(0, ...yourSets.map((meldSet) => meldSet.strongestComparisonValue));
  const enemyHighest = Math.max(0, ...enemySets.map((meldSet) => meldSet.strongestComparisonValue));

  if (yourHighest === 0 && enemyHighest === 0) {
    return null;
  }

  const winningTeam = yourHighest > enemyHighest ? "YOURS" : enemyHighest > yourHighest ? "ENEMIES" : declarer;
  if (!winningTeam) {
    return null;
  }

  const players = winningTeam === "YOURS" ? yourSets : enemySets;
  return {
    team: winningTeam,
    teamName: teamNameFor(winningTeam),
    players,
    totalPoints: players.reduce((sum, player) => sum + player.totalPoints, 0)
  };
}

function groupCardsByRank(cards: Card[]) {
  const byRank = new Map<Rank, Card[]>();
  for (const card of cards) {
    const matchingCards = byRank.get(card.rank) ?? [];
    matchingCards.push(card);
    byRank.set(card.rank, matchingCards);
  }
  return byRank;
}

function groupCardsBySuit(cards: Card[]) {
  const bySuit = new Map<Suit, Card[]>();
  for (const card of cards) {
    const suitedCards = bySuit.get(card.suit) ?? [];
    suitedCards.push(card);
    bySuit.set(card.suit, suitedCards);
  }
  return bySuit;
}

function sameRankCandidates(cards: Card[]): MeldCombination[] {
  const combinations: MeldCombination[] = [];
  const byRank = groupCardsByRank(cards);

  for (const [rank, matchingCards] of byRank.entries()) {
    if (matchingCards.length !== 4 || rank === "SEVEN" || rank === "EIGHT") {
      continue;
    }

    if (rank === "JACK") {
      combinations.push({
        kind: "FOUR_OF_A_KIND",
        label: "Four Jacks",
        points: 200,
        comparisonValue: 700 + RANKS.indexOf(rank),
        cards: [...matchingCards]
      });
      continue;
    }

    if (rank === "NINE") {
      combinations.push({
        kind: "FOUR_OF_A_KIND",
        label: "Four Nines",
        points: 150,
        comparisonValue: 650 + RANKS.indexOf(rank),
        cards: [...matchingCards]
      });
      continue;
    }

    combinations.push({
      kind: "FOUR_OF_A_KIND",
      label: "Four of a Kind",
      points: 100,
      comparisonValue: 600 + RANKS.indexOf(rank),
      cards: [...matchingCards]
    });
  }

  return combinations;
}

function sequenceCandidates(cards: Card[]): MeldCombination[] {
  const combinations: MeldCombination[] = [];
  const bySuit = groupCardsBySuit(cards);

  for (const suitedCards of bySuit.values()) {
    const sortedCards = [...suitedCards].sort((left, right) => RANKS.indexOf(left.rank) - RANKS.indexOf(right.rank));
    for (let start = 0; start < sortedCards.length; start += 1) {
      const run: Card[] = [sortedCards[start]];
      for (let index = start + 1; index < sortedCards.length; index += 1) {
        if (RANKS.indexOf(sortedCards[index].rank) !== RANKS.indexOf(sortedCards[index - 1].rank) + 1) {
          break;
        }
        run.push(sortedCards[index]);
        if (run.length >= 3) {
          combinations.push(toSequenceCombination(run));
        }
      }
    }
  }

  return combinations;
}

function toSequenceCombination(run: Card[]): MeldCombination {
  const highest = run[run.length - 1];
  if (run.length >= 5) {
    return {
      kind: "SEQUENCE",
      label: `Sequence of ${run.length}`,
      points: 100,
      comparisonValue: 500 + RANKS.indexOf(highest.rank),
      cards: [...run]
    };
  }

  if (run.length === 4) {
    return {
      kind: "SEQUENCE",
      label: "Sequence of 4",
      points: 50,
      comparisonValue: 450 + RANKS.indexOf(highest.rank),
      cards: [...run]
    };
  }

  return {
    kind: "SEQUENCE",
    label: "Sequence of 3",
    points: 20,
    comparisonValue: 400 + RANKS.indexOf(highest.rank),
    cards: [...run]
  };
}

interface BestSelection {
  melds: MeldCombination[];
  totalPoints: number;
  strongestComparisonValue: number;
}

function chooseBestNonOverlapping(
  candidates: MeldCombination[],
  index: number,
  usedCards: Set<string>,
  chosen: MeldCombination[],
  totalPoints: number,
  strongestComparisonValue: number,
  best: BestSelection | null
): BestSelection | null {
  let currentBest = best;
  if (index >= candidates.length) {
    const candidate: BestSelection = {
      melds: [...chosen],
      totalPoints,
      strongestComparisonValue
    };
    return !currentBest || beatsSelection(candidate, currentBest) ? candidate : currentBest;
  }

  currentBest = chooseBestNonOverlapping(candidates, index + 1, usedCards, chosen, totalPoints, strongestComparisonValue, currentBest);
  const combination = candidates[index];
  const combinationKeys = combination.cards.map(cardKey);
  if (combinationKeys.every((key) => !usedCards.has(key))) {
    combinationKeys.forEach((key) => usedCards.add(key));
    chosen.push(combination);
    currentBest = chooseBestNonOverlapping(
      candidates,
      index + 1,
      usedCards,
      chosen,
      totalPoints + combination.points,
      Math.max(strongestComparisonValue, combination.comparisonValue),
      currentBest
    );
    chosen.pop();
    combinationKeys.forEach((key) => usedCards.delete(key));
  }

  return currentBest;
}

function beatsSelection(candidate: BestSelection, best: BestSelection) {
  if (candidate.totalPoints !== best.totalPoints) {
    return candidate.totalPoints > best.totalPoints;
  }
  if (candidate.strongestComparisonValue !== best.strongestComparisonValue) {
    return candidate.strongestComparisonValue > best.strongestComparisonValue;
  }
  return candidate.melds.length < best.melds.length;
}

function cardKey(card: Card) {
  return `${card.suit}:${card.rank}`;
}
