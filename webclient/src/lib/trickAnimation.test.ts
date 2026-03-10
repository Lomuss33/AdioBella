import { buildAnimatedTrick } from "./trickAnimation";
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
