import { trickLeader } from "./trickLeader";
import type { PlayedCardView, Seat } from "../types";

const play = (seat: Seat, rank: string, suit: string): PlayedCardView => ({
  seat, playerId: seat, playerName: seat,
  card: { rank, suit, label: `${rank}_${suit}`, faceUp: true, playable: false }
});

test("only the led suit or trump can win a partial trick", () => {
  expect(trickLeader([], "SPADES")).toBeUndefined();
  const king = play("SOUTH", "KING", "HEARTS");
  expect(trickLeader([king, play("WEST", "ACE", "CLUBS")], "SPADES")).toBe(king);
  const ace = play("WEST", "ACE", "HEARTS");
  expect(trickLeader([king, ace], "SPADES")).toBe(ace);
  const trump = play("NORTH", "SEVEN", "SPADES");
  expect(trickLeader([king, ace, trump, play("EAST", "ACE", "DIAMONDS")], "SPADES")).toBe(trump);
});

test.each([
  [null, "HEARTS", ["SEVEN", "EIGHT", "NINE", "JACK", "QUEEN", "KING", "TEN", "ACE"]],
  ["SPADES", "SPADES", ["SEVEN", "EIGHT", "QUEEN", "KING", "TEN", "ACE", "NINE", "JACK"]]
] as const)("uses the complete rank order for trump %s", (trump, suit, ranks) => {
  for (let low = 0; low < ranks.length; low++) for (let high = low + 1; high < ranks.length; high++) {
    const weaker = play("WEST", ranks[low], suit), stronger = play("SOUTH", ranks[high], suit);
    expect(trickLeader([weaker, stronger], trump)).toBe(stronger);
    expect(trickLeader([stronger, weaker], trump)).toBe(stronger);
  }
});
