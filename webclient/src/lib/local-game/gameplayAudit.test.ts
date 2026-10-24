import { expect, test } from "vitest";
import type { Difficulty, GameEvent, Rank, Suit } from "../../types";
import { BelotMatchFacade } from "./belotMatchFacade";
import { SeededRandom } from "./random";

// Scenario fixtures use the same internal setup approach as the Java rule tests.
function scenario(hands: string[][]) {
  const facade = new BelotMatchFacade(new SeededRandom(7));
  const state = Reflect.get(facade, "state");
  Object.assign(state, { trumpSuit: "HEARTS", declarer: "YOURS", declarerPlayerIndex: 0,
    currentPlayerIndex: 0, gameNumber: 1, phase: "TRICK_PLAY", pendingType: "PLAY_CARD",
    currentTrick: { leadPlayerIndex: 0, cards: [] } });
  hands.forEach((cards, index) => {
    state.players[index].hand = cards.map(code => ({ suit: code.split(":")[0], rank: code.split(":")[1] }));
  });
  return { facade, state };
}

test("a low trump takes a plain ace and the correct team receives its points", () => {
  const { facade } = scenario([
    ["SPADES:ACE", "CLUBS:SEVEN"], ["HEARTS:SEVEN", "DIAMONDS:SEVEN"],
    ["SPADES:KING", "CLUBS:EIGHT"], ["SPADES:QUEEN", "DIAMONDS:EIGHT"]
  ]);
  facade.playCard(0);
  const win = facade.getEventsAfter(0).find(event => event.payload.eventKind === "TRICK_WIN")!;
  expect(win.payload.winnerPlayerId).toBe("west");
  expect(win.payload.trickPoints).toBe("18");
});

test("legal discards and overtrumping follow the actual current winner", () => {
  const { facade, state } = scenario([
    ["HEARTS:NINE", "HEARTS:SEVEN", "DIAMONDS:ACE"], [], [], []
  ]);
  state.currentTrick.cards = [
    { playerIndex: 1, card: { suit: "SPADES", rank: "ACE" } },
    { playerIndex: 2, card: { suit: "HEARTS", rank: "EIGHT" } },
    { playerIndex: 3, card: { suit: "SPADES", rank: "TEN" } }
  ];
  expect(facade.getSnapshot().pendingAction.legalCardIndices).toEqual([0, 1, 2]);
  state.currentTrick.cards[2].card = { suit: "HEARTS", rank: "QUEEN" };
  expect(facade.getSnapshot().pendingAction.legalCardIndices).toEqual([0]);
});

test("winning a zero-point trick makes the team's declared melds count", () => {
  const { facade, state } = scenario([
    ["CLUBS:EIGHT", "HEARTS:ACE"], ["CLUBS:SEVEN", "HEARTS:SEVEN"],
    ["DIAMONDS:SEVEN", "SPADES:SEVEN"], ["DIAMONDS:EIGHT", "SPADES:EIGHT"]
  ]);
  state.teamOne.meldPoints = 20;
  facade.playCard(0);
  expect(state.teamOne.trickPoints).toBe(0);
  expect(facade.getSnapshot().score.teamOneGamePoints).toBe(20);
});

test("Bela appears in details even without a winning meld and cannot be called twice", () => {
  const { facade } = scenario([
    ["HEARTS:QUEEN", "HEARTS:KING", "HEARTS:ACE"], ["SPADES:ACE", "SPADES:KING", "SPADES:QUEEN"],
    ["CLUBS:ACE", "CLUBS:KING", "CLUBS:QUEEN"], ["DIAMONDS:ACE", "DIAMONDS:KING", "DIAMONDS:QUEEN"]
  ]);
  facade.playCardWithBela(0, true);
  expect(facade.getSnapshot().score.meldDeclarations).toEqual([
    expect.objectContaining({ playerId: "south", meldPoints: 0, belaPoints: 20, melds: [] })
  ]);
  expect(facade.getSnapshot().pendingAction.belaEligibleCardIndices).toEqual([]);
});

test.each([1, 3, 5] as const)("first to %i progresses only after explicit next-game actions", target => {
  const facade = new BelotMatchFacade(new SeededRandom(7));
  facade.updateGameSettings(target, "SHORT");
  for (let game = 1; game <= target; game++) {
    facade.startMatch();
    expect(facade.getSnapshot().score.gameNumber).toBe(game);
    facade.forfeitGame();
    const snapshot = facade.getSnapshot();
    expect(snapshot.score.teamTwoMatchScore).toBe(game);
    expect(snapshot.score.teamTwoGamePoints).toBe(501);
    expect(snapshot.phase).toBe(game === target ? "MATCH_COMPLETE" : "BETWEEN_GAMES");
    expect(() => facade.forfeitGame()).toThrow();
  }
});

test("conceding a match between games preserves the completed game's score and result", () => {
  const facade = new BelotMatchFacade(new SeededRandom(7));
  facade.startMatch();
  facade.forfeitGame();
  const before = facade.getSnapshot();
  facade.forfeitMatch();
  const after = facade.getSnapshot();
  expect(after.matchComplete).toBe(true);
  expect(after.score.teamOneGamePoints).toBe(before.score.teamOneGamePoints);
  expect(after.score.teamTwoGamePoints).toBe(before.score.teamTwoGamePoints);
  expect(facade.getEventsAfter(before.lastEventSequence).map(event => event.payload.eventKind))
    .toEqual(["MATCH_FORFEIT", "MATCH_WIN"]);
});

const suits: Suit[] = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];
const plain: Rank[] = ["SEVEN", "EIGHT", "NINE", "JACK", "QUEEN", "KING", "TEN", "ACE"];
const trump: Rank[] = ["SEVEN", "EIGHT", "QUEEN", "KING", "TEN", "ACE", "NINE", "JACK"];

test.each<Difficulty>(["EASY", "NORMAL", "HARD"])("complete seeded %s matches conserve cards, points and trick winners", difficulty => {
  for (let seed = 1; seed <= 16; seed++) {
    const facade = new BelotMatchFacade(new SeededRandom(seed), difficulty);
    facade.updateGameSettings(1, "SHORT");
    facade.startMatch();
    let steps = 0;
    while (!facade.getSnapshot().matchComplete && steps++ < 1000) {
      const action = facade.getSnapshot().pendingAction;
      switch (action.type) {
        case "CHOOSE_TRUMP": facade.chooseTrump(seed % 2 && action.legalTrumpChoices.includes("SKIP") ? "SKIP" : suits[(seed + steps) % 4]); break;
        case "REPORT_MELDS": facade.reportMelds(seed % 3 !== 0); break;
        case "ACKNOWLEDGE_MELDS": facade.acknowledgeMelds(); break;
        case "PLAY_CARD": {
          const index = action.legalCardIndices[(seed + steps) % action.legalCardIndices.length];
          facade.playCardWithBela(index, action.belaEligibleCardIndices.includes(index));
          break;
        }
        default: throw new Error(`Game stalled at ${action.type}, seed ${seed}`);
      }
    }
    expect(facade.getSnapshot().matchComplete, `seed ${seed}`).toBe(true);
    let trumpSuit = "";
    let trick: GameEvent[] = [];
    let hand: string[] = [];
    let trickCount = 0;
    let cardPoints = 0;
    for (const event of facade.getEventsAfter(0)) {
      const payload = event.payload;
      switch (payload.eventKind) {
        case "TRUMP_CHOSEN": trumpSuit = payload.trump; break;
        case "PLAY_CARD": trick.push(event); hand.push(payload.card); break;
        case "TRICK_WIN": {
          expect(trick).toHaveLength(4);
          const lead = trick[0].payload.suit;
          const strength = (play: GameEvent) => play.payload.suit === trumpSuit ? 100 + trump.indexOf(play.payload.rank as Rank)
            : play.payload.suit === lead ? 10 + plain.indexOf(play.payload.rank as Rank) : 0;
          const winner = trick.reduce((winner, play) => strength(play) > strength(winner) ? play : winner);
          expect(payload.winnerPlayerId, `seed ${seed}, trick ${trickCount}`).toBe(winner.payload.playerId);
          cardPoints += Number(payload.trickPoints);
          trickCount++;
          trick = [];
          break;
        }
        case "HAND_PASSED": case "HAND_FAILED":
          expect(new Set(hand).size).toBe(32);
          expect(hand).toHaveLength(32);
          expect(trickCount).toBe(8);
          expect(cardPoints).toBe(162);
          hand = []; trickCount = 0; cardPoints = 0;
          break;
      }
    }
    expect(hand).toEqual([]);
  }
});
