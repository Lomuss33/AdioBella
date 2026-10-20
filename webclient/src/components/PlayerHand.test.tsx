import { fireEvent, render, screen } from "@testing-library/react";
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

test("keeps the cards in hand order and plays the original index", () => {
  const onPlayCard = vi.fn();
  render(<PlayerHand player={player} pendingType="PLAY_CARD" onPlayCard={onPlayCard} />);
  const cards = screen.getAllByRole("button");
  expect(cards).toHaveLength(2);
  fireEvent.click(cards[1]);
  expect(onPlayCard).toHaveBeenCalledWith(1);
});

test("preserves the remaining card through an optimistic hide and confirmed play", () => {
  const onPlayCard = vi.fn();
  const { rerender } = render(<PlayerHand player={player} pendingType="PLAY_CARD" hiddenIndex={0} onPlayCard={onPlayCard} />);
  const remainingCard = screen.getByRole("button");
  fireEvent.click(remainingCard);
  expect(onPlayCard).toHaveBeenLastCalledWith(1);

  rerender(<PlayerHand player={{ ...player, hand: [player.hand[1]], handSize: 1 }} pendingType="PLAY_CARD" hiddenIndex={null} onPlayCard={onPlayCard} />);
  expect(screen.getByRole("button")).toBe(remainingCard);
  fireEvent.click(remainingCard);
  expect(onPlayCard).toHaveBeenLastCalledWith(0);
});

test("can mount the hand after the player becomes available", () => {
  const { rerender } = render(<PlayerHand onPlayCard={() => {}} />);
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  rerender(<PlayerHand player={player} pendingType="PLAY_CARD" onPlayCard={() => {}} />);
  expect(screen.getByRole("group", { name: "Your hand" })).toBeInTheDocument();
});
