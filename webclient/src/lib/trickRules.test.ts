import { describe, expect, test } from "vitest";
import type { Rank, Suit } from "../types";
import { trickCardStrength } from "./trickRules";

const suits: Suit[] = ["HEARTS", "SPADES", "CLUBS", "DIAMONDS"];
const plain: Rank[] = ["SEVEN", "EIGHT", "NINE", "JACK", "QUEEN", "KING", "TEN", "ACE"];
const trump: Rank[] = ["SEVEN", "EIGHT", "QUEEN", "KING", "TEN", "ACE", "NINE", "JACK"];

describe("trick comparison", () => {
  test("every trump outranks every plain card in every suit", () => {
    for (const trumpSuit of suits) for (const leadSuit of suits.filter(suit => suit !== trumpSuit)) {
      for (const rank of trump) for (const plainRank of plain) {
        expect(trickCardStrength({ suit: trumpSuit, rank }, leadSuit, trumpSuit))
          .toBeGreaterThan(trickCardStrength({ suit: leadSuit, rank: plainRank }, leadSuit, trumpSuit));
      }
    }
  });

  test("rank ordering and off-suit discards are consistent", () => {
    for (const order of [plain, trump]) for (let index = 1; index < order.length; index++) {
      const trumpSuit = order === trump ? "HEARTS" : "CLUBS";
      expect(trickCardStrength({ suit: "HEARTS", rank: order[index] }, "HEARTS", trumpSuit))
        .toBeGreaterThan(trickCardStrength({ suit: "HEARTS", rank: order[index - 1] }, "HEARTS", trumpSuit));
    }
    expect(trickCardStrength({ suit: "SPADES", rank: "ACE" }, "HEARTS", "CLUBS")).toBe(0);
  });
});
