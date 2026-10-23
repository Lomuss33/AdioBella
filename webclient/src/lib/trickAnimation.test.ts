import { buildAnimatedTrick, buildAnimatedTrickTimeline } from "./trickAnimation";
import { CARD_TIMING, collectionMotionTiming } from "./cardAnimationConfig";
import type { GameEvent, GameSnapshot } from "../types";

const baseSnapshot: GameSnapshot = {
  phase: "TRICK_PLAY",
  trumpSuit: "HEARTS",
  dealerPlayerId: "east",
  declarerPlayerId: "south",
  currentPlayerId: "south",
  players: [],
  trick: { leadPlayerId: null, cards: [] },
  score: {
    teamOneName: "Your Team",
    teamOneMatchScore: 0,
    teamOneGamePoints: 0,
    teamTwoName: "Enemy Team",
    teamTwoMatchScore: 0,
    teamTwoGamePoints: 0,
    declarerTeam: "Your Team",
    gameNumber: 1,
    difficulty: "NORMAL",
    matchTargetWins: 3,
    gameTargetPoints: 1001,
    teamOneMeldPoints: 0,
    teamTwoMeldPoints: 0,
    meldDeclarations: []
  },
  pendingAction: {
    type: "PLAY_CARD",
    actingPlayerId: "south",
    legalCardIndices: [0],
    legalTrumpChoices: [],
    belaEligibleCardIndices: [],
    availableMelds: [],
    meldWinner: null,
    validationMessage: null,
    prompt: "Play a legal card."
  },
  lastEventSequence: 4,
  matchComplete: false
};

test("builds an animated trick from confirmed play and trick-win events", () => {
  const events: GameEvent[] = [
    {
      sequence: 5,
      type: "ACTION",
      message: "You played AH.",
      createdAt: "2026-03-10T12:00:00Z",
      payload: {
        eventKind: "PLAY_CARD",
        playerId: "south",
        playerSeat: "SOUTH",
        card: "AH",
        rank: "ACE",
        suit: "HEARTS"
      }
    },
    {
      sequence: 6,
      type: "ACTION",
      message: "Bot West played KD.",
      createdAt: "2026-03-10T12:00:00Z",
      payload: {
        eventKind: "PLAY_CARD",
        playerId: "west",
        playerSeat: "WEST",
        card: "KD",
        rank: "KING",
        suit: "DIAMONDS"
      }
    },
    {
      sequence: 7,
      type: "SCORE",
      message: "You won the trick for 15 points.",
      createdAt: "2026-03-10T12:00:01Z",
      payload: {
        eventKind: "TRICK_WIN",
        winnerPlayerId: "south",
        winnerSeat: "SOUTH",
        trickPoints: "15",
        lastTrickBonus: "0",
        trickCardCount: "2",
        team: "Your Team"
      }
    }
  ];

  const animation = buildAnimatedTrick(baseSnapshot, { ...baseSnapshot, trick: { leadPlayerId: null, cards: [] } }, events);

  expect(animation).not.toBeNull();
  expect(animation?.plays).toHaveLength(2);
  expect(animation?.plays[0].seat).toBe("SOUTH");
  expect(animation?.plays[1].seat).toBe("WEST");
  expect(animation?.plays[0].pointsAfterLanding).toBe(11);
  expect(animation?.resolution?.winnerSeat).toBe("SOUTH");
  expect(animation?.resolution?.trickPoints).toBe(15);
});

test("separates a completed trick's reading and empty-table rests from the next lead", () => {
  const seats = ["SOUTH", "WEST", "NORTH", "EAST"];
  const events: GameEvent[] = seats.map((seat, index) => ({
    sequence: 5 + index, type: "ACTION", message: `${seat} played a card.`, createdAt: "2026-10-23T12:00:00Z",
    payload: { eventKind: "PLAY_CARD", playerSeat: seat, playerId: seat, suit: "HEARTS", rank: "ACE", card: `card-${seat}` }
  }));
  events.push({ sequence: 9, type: "SCORE", message: "Trick won.", createdAt: "2026-10-23T12:00:01Z",
    payload: { eventKind: "TRICK_WIN", winnerSeat: "WEST", winnerPlayerId: "WEST", trickPoints: "44" } });
  events.push({ ...events[1], sequence: 10, payload: { ...events[1].payload, rank: "SEVEN", card: "7H" } });
  const segments = buildAnimatedTrickTimeline(baseSnapshot, baseSnapshot, events.reverse());
  expect(segments).toHaveLength(2);
  const [completed, next] = segments;
  const last = completed.plays.at(-1)!;
  const resolution = completed.resolution!;
  expect(completed.plays).toHaveLength(4);
  expect(resolution.countUpStartMs).toBe(last.startAtMs + last.durationMs);
  expect(resolution.collectStartMs - resolution.countUpStartMs).toBe(CARD_TIMING.completedTrickHoldMs);
  expect(resolution.restDurationMs).toBe(CARD_TIMING.clearTableRestMs);
  expect(next.baseCards).toEqual([]);
  expect(next.plays).toHaveLength(1);
  expect(next.plays[0].startAtMs).toBe(0);
  expect(next.resolution).toBeNull();
  expect(next.pointsDisplay).toBe(0);
});

test.each([16, 100, CARD_TIMING.collectionMs, 1200])("all collection paths finish within a tuned %i ms window", totalMs => {
  for (const count of [1, 4]) {
    const paths = Array.from({ length: count }, (_, index) => collectionMotionTiming(index, count, totalMs));
    expect(paths.every(path => path.duration > 0 && path.delay >= 0 && path.duration + path.delay <= totalMs)).toBe(true);
    expect(paths.at(-1)!.duration + paths.at(-1)!.delay).toBe(totalMs);
  }
});
