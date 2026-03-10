import type {
  AnimatedPlayStep,
  AnimatedTrickState,
  CardView,
  GameEvent,
  GameSnapshot,
  PlayedCardView,
  Seat,
  TrickResolutionStep
} from "../types";

export const CARD_SELECTION_DELAY_MS = 140;
export const PLAY_MOUNT_BUFFER_MS = 32;
export const HUMAN_LAUNCH_DURATION_MS = 260;
export const HUMAN_HOLD_AFTER_LAND_MS = 220;
export const BOT_DROP_DURATION_MS = 210;
export const BOT_DROP_STAGGER_MS = 150;
export const WINNER_HIGHLIGHT_HOLD_MS = 650;
export const POINTS_FINAL_PULSE_MS = 260;
export const COLLECT_DURATION_MS = 520;
export const POST_COLLECT_SETTLE_MS = 180;

export function buildAnimatedTrick(
  previousSnapshot: GameSnapshot,
  nextSnapshot: GameSnapshot,
  events: GameEvent[]
): AnimatedTrickState | null {
  return buildAnimatedTrickTimeline(previousSnapshot, nextSnapshot, events)[0] ?? null;
}

export function buildAnimatedTrickTimeline(
  previousSnapshot: GameSnapshot,
  _nextSnapshot: GameSnapshot,
  events: GameEvent[]
) {
  const orderedEvents = [...events].sort((left, right) => left.sequence - right.sequence);
  const segments: AnimatedTrickState[] = [];
  let currentBaseCards = previousSnapshot.trick.cards;
  let currentPlayEvents: GameEvent[] = [];

  for (const event of orderedEvents) {
    const eventKind = event.payload.eventKind;
    if (eventKind === "PLAY_CARD") {
      currentPlayEvents.push(event);
      continue;
    }

    if (eventKind === "TRICK_WIN") {
      const segment = buildAnimatedTrickSegment(currentBaseCards, previousSnapshot.trumpSuit, currentPlayEvents, event);
      if (segment) {
        segments.push(segment);
      }
      currentBaseCards = [];
      currentPlayEvents = [];
    }
  }

  const unfinishedSegment = buildAnimatedTrickSegment(currentBaseCards, previousSnapshot.trumpSuit, currentPlayEvents, null);
  if (unfinishedSegment) {
    segments.push(unfinishedSegment);
  }

  return segments;
}

function buildAnimatedTrickSegment(
  baseCards: PlayedCardView[],
  trumpSuit: string | null,
  playEvents: GameEvent[],
  trickWinEvent: GameEvent | null
) {
  if (playEvents.length === 0) {
    return null;
  }

  const playSteps = playEvents.map((event, index) => toAnimatedPlayStep(event, trumpSuit, index, baseCards.length));
  const basePoints = baseCards.reduce((total, playedCard) => total + cardPoints(playedCard.card, trumpSuit), 0);
  let runningPoints = basePoints;
  const plays = playSteps.map((step) => {
    runningPoints += step.landingPoints;
    return {
      ...step,
      pointsAfterLanding: runningPoints
    };
  });

  const resolution = trickWinEvent ? toResolutionStep(trickWinEvent, plays) : null;
  const allCards = [...baseCards, ...plays.map(toPlayedCardView)];
  const winningCardKey = resolution ? findWinningCardKey(allCards, resolution.winnerPlayerId) : null;

  return {
    baseCards,
    plays,
    visiblePlayCount: 0,
    enteringPlayIndex: null,
    phase: "placing" as const,
    winnerSeat: null,
    winnerPlayerId: null,
    winningCardKey,
    pointsDisplay: basePoints,
    pointsVisible: basePoints > 0,
    pointsPulse: false,
    resolution
  };
}

export function toRenderedTrickCards(animation: AnimatedTrickState | null, liveTrickCards: PlayedCardView[]) {
  if (!animation) {
    return liveTrickCards;
  }

  return [...animation.baseCards, ...animation.plays.slice(0, animation.visiblePlayCount).map(toPlayedCardView)];
}

function toAnimatedPlayStep(
  event: GameEvent,
  trumpSuit: string | null,
  stepIndex: number,
  existingCardCount: number
): AnimatedPlayStep {
  const startAtMs =
    stepIndex === 0
      ? 0
      : HUMAN_LAUNCH_DURATION_MS + HUMAN_HOLD_AFTER_LAND_MS + (stepIndex - 1) * (BOT_DROP_DURATION_MS + BOT_DROP_STAGGER_MS);
  const durationMs = stepIndex === 0 ? HUMAN_LAUNCH_DURATION_MS : BOT_DROP_DURATION_MS;
  const card = {
    suit: event.payload.suit ?? null,
    rank: event.payload.rank ?? null,
    label: event.payload.card ?? "",
    faceUp: true,
    playable: false
  } satisfies CardView;

  return {
    seat: (event.payload.playerSeat as Seat | undefined) ?? inferSeatFromExisting(stepIndex, existingCardCount),
    playerId: event.payload.playerId ?? "",
    playerName: event.payload.playerName ?? parsePlayerName(event.message),
    card,
    startAtMs,
    durationMs,
    landingPoints: cardPoints(card, trumpSuit),
    pointsAfterLanding: 0
  };
}

function toResolutionStep(event: GameEvent, plays: AnimatedPlayStep[]): TrickResolutionStep {
  const lastPlay = plays[plays.length - 1];
  const highlightStart = lastPlay.startAtMs + lastPlay.durationMs;
  return {
    winnerSeat: event.payload.winnerSeat as Seat,
    winnerPlayerId: event.payload.winnerPlayerId ?? event.payload.playerId ?? "",
    trickPoints: Number(event.payload.trickPoints ?? "0"),
    countUpStartMs: highlightStart,
    highlightDurationMs: WINNER_HIGHLIGHT_HOLD_MS,
    collectStartMs: highlightStart + WINNER_HIGHLIGHT_HOLD_MS,
    collectDurationMs: COLLECT_DURATION_MS,
    lastTrickBonus: Number(event.payload.lastTrickBonus ?? "0")
  };
}

function toPlayedCardView(step: AnimatedPlayStep): PlayedCardView {
  return {
    playerId: step.playerId,
    playerName: step.playerName,
    seat: step.seat,
    card: step.card
  };
}

function findWinningCardKey(cards: PlayedCardView[], winnerPlayerId: string) {
  const winnerCard = cards.find((card) => card.playerId === winnerPlayerId);
  return winnerCard ? cardKey(winnerCard) : null;
}

export function cardKey(playedCard: PlayedCardView) {
  return `${playedCard.playerId}-${playedCard.card.label}`;
}

function parsePlayerName(message: string) {
  const [name] = message.split(" played ");
  return name.trim();
}

function inferSeatFromExisting(stepIndex: number, existingCardCount: number): Seat {
  const order: Seat[] = ["SOUTH", "WEST", "NORTH", "EAST"];
  return order[(existingCardCount + stepIndex) % order.length];
}

export function cardPoints(card: CardView, trumpSuit: string | null) {
  if (!card.suit || !card.rank) {
    return 0;
  }

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
    default:
      return 0;
  }
}
