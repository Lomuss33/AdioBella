import { afterEach, describe, expect, test, vi } from "vitest";
import { BelotMatchFacade } from "./belotMatchFacade";
import { SeededRandom } from "./random";

afterEach(() => vi.useRealTimers());

function advance(game: BelotMatchFacade) {
  const action = game.getSnapshot().pendingAction;
  switch (action.type) {
    case "START_MATCH": case "START_NEXT_GAME": game.startMatch(); break;
    case "CHOOSE_TRUMP": game.chooseTrump("HEARTS"); break;
    case "REPORT_MELDS": game.reportMelds(true); break;
    case "ACKNOWLEDGE_MELDS": game.acknowledgeMelds(); break;
    case "PLAY_CARD": game.playCardWithBela(action.legalCardIndices[0], action.belaEligibleCardIndices.includes(action.legalCardIndices[0])); break;
    default: throw new Error(`Unexpected action ${action.type}`);
  }
}

describe("saved solo games", () => {
  test("restoring after every action preserves hands, melds, scoring and event history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01"));
    const seen = new Set<string>();
    for (const seed of [7, 42, 99, 123]) {
      const initial = new BelotMatchFacade(new SeededRandom(seed));
      initial.startMatch();
      const random = { nextFloat: () => 0.3, nextInt: (bound: number) => Math.floor(bound * 0.3) };
      const baseline = new BelotMatchFacade(random);
      baseline.restoreGame(initial.saveGame());
      let restored = new BelotMatchFacade(random);
      restored.restoreGame(initial.saveGame());
      for (let step = 0; step < 130 && !baseline.getSnapshot().matchComplete; step++) {
        seen.add(baseline.getSnapshot().pendingAction.type);
        expect(restored.getSnapshot()).toEqual(baseline.getSnapshot());
        advance(baseline);
        advance(restored);
        expect(restored.saveGame()).toBe(baseline.saveGame());
        const saved = restored.saveGame();
        restored = new BelotMatchFacade(random);
        restored.restoreGame(saved);
        expect(restored.getEventsAfter(0)).toEqual(baseline.getEventsAfter(0));
      }
    }
    for (const phase of ["CHOOSE_TRUMP", "REPORT_MELDS", "ACKNOWLEDGE_MELDS", "PLAY_CARD"]) {
      expect(seen.has(phase)).toBe(true);
    }
  });

  test("lobby, between games and completed matches survive restoration", () => {
    const original = new BelotMatchFacade(new SeededRandom(7));
    original.updateLobbySettings("HARD", { SOUTH: "Lovro" }, "Friends", "Rivals", 3, "SHORT");
    for (const action of [() => {}, () => original.startMatch(), () => original.forfeitGame(), () => original.forfeitMatch()]) {
      action();
      const restored = new BelotMatchFacade();
      restored.restoreGame(original.saveGame());
      expect(restored.getSnapshot()).toEqual(original.getSnapshot());
    }
  });

  test("rejects malformed, incompatible and incomplete saves", () => {
    const game = new BelotMatchFacade();
    for (const saved of ["bad json", "null", "{}", '{"version":2}', JSON.stringify({
      ...JSON.parse(game.saveGame()), state: { players: [] }
    })]) {
      expect(() => game.restoreGame(saved)).toThrow();
    }
  });
});
