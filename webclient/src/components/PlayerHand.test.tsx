import { render } from "@testing-library/react";
import PlayerHand from "./PlayerHand";
import type { PlayerView } from "../types";

const player: PlayerView = {
  id: "south",
  name: "You",
  seat: "SOUTH",
  human: true,
  team: "Your Team",
  hand: [
    { suit: "SPADES", rank: "ACE", label: "AS", faceUp: true, playable: true },
    { suit: "HEARTS", rank: "KING", label: "KH", faceUp: true, playable: true }
  ],
  handSize: 2,
  matchScore: 0,
  gamePoints: 0,
  dealer: false,
  currentTurn: true
};

test("renders a centered eight-slot hand row with empty ghost slots", () => {
  const { container } = render(<PlayerHand player={player} pendingType="PLAY_CARD" onPlayCard={() => {}} />);

  expect(container.querySelectorAll(".hand-slot")).toHaveLength(8);
  expect(container.querySelectorAll(".hand-slot-empty")).toHaveLength(6);
  expect(container.querySelectorAll(".playing-card-shell")).toHaveLength(2);
});
