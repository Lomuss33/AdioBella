import { render } from "@testing-library/react";
import TrickPile from "./TrickPile";
import type { AnimatedTrickState, PlayedCardView, Seat } from "../types";

const play = (seat: Seat, rank: string, suit: string): PlayedCardView => ({
  seat, playerId: seat, playerName: seat,
  card: { rank, suit, label: `${rank}_${suit}`, faceUp: true, playable: false }
});

test("keeps the rest empty even when the live snapshot already contains the next lead", () => {
  const oldCard = play("SOUTH", "ACE", "HEARTS");
  const nextCard = play("WEST", "KING", "SPADES");
  const animation: AnimatedTrickState = {
    baseCards: [oldCard], plays: [], visiblePlayCount: 0, enteringPlayIndex: null,
    phase: "resting", winnerSeat: "WEST", winnerPlayerId: "WEST", winningCardKey: null,
    pointsDisplay: 11, pointsVisible: true, pointsPulse: false, resolution: null
  };
  const { container, rerender } = render(<TrickPile trick={{ cards: [nextCard], leadPlayerId: "WEST" }} animatedTrick={animation} />);
  expect(container.querySelectorAll(".trick-card-stack")).toHaveLength(0);
  expect(container.querySelector(".trick-points-chip")).not.toBeInTheDocument();
  rerender(<TrickPile trick={{ cards: [nextCard], leadPlayerId: "WEST" }} />);
  expect(container.querySelectorAll(".trick-card-stack")).toHaveLength(1);
  expect(container.querySelector(".trick-card-stack")).toHaveClass("trick-seat-west");
});

test("switches the points indicator between partnerships as the leading card changes", () => {
  const cards = [play("SOUTH", "KING", "HEARTS"), play("WEST", "ACE", "HEARTS"),
    play("NORTH", "SEVEN", "SPADES"), play("EAST", "JACK", "SPADES")];
  const { container, rerender } = render(<TrickPile trick={{ cards: [], leadPlayerId: null }} trumpSuit="SPADES" />);
  expect(container.querySelector(".trick-points-chip")).not.toBeInTheDocument();
  for (let count = 1; count <= cards.length; count++) {
    rerender(<TrickPile trick={{ cards: cards.slice(0, count), leadPlayerId: "SOUTH" }} trumpSuit="SPADES" />);
    expect(container.querySelector(".trick-points-chip")).toHaveAttribute("data-team", count % 2 ? "your" : "opponent");
  }
});

test("uses visible cards during placement and the confirmed winner through collection", () => {
  const cards = [play("SOUTH", "ACE", "HEARTS"), play("WEST", "SEVEN", "SPADES")];
  const animation: AnimatedTrickState = {
    baseCards: [cards[0]], plays: [{ ...cards[1], startAtMs: 0, durationMs: 200, landingPoints: 0, pointsAfterLanding: 11 }],
    visiblePlayCount: 0, enteringPlayIndex: null, phase: "placing", winnerSeat: null,
    winnerPlayerId: null, winningCardKey: "WEST-SEVEN_SPADES", pointsDisplay: 11,
    pointsVisible: true, pointsPulse: false, resolution: null
  };
  const { container, rerender } = render(<TrickPile trick={{ cards, leadPlayerId: "SOUTH" }} trumpSuit="SPADES" animatedTrick={animation} />);
  // The later trump exists in the confirmed snapshot but is not visible yet.
  expect(container.querySelector(".trick-points-chip")).toHaveAttribute("data-team", "your");
  rerender(<TrickPile trick={{ cards, leadPlayerId: "SOUTH" }} trumpSuit="SPADES"
    animatedTrick={{ ...animation, visiblePlayCount: 1 }} />);
  expect(container.querySelector(".trick-points-chip")).toHaveAttribute("data-team", "opponent");
  for (const phase of ["highlight", "collecting"] as const) {
    rerender(<TrickPile trick={{ cards: [], leadPlayerId: null }} trumpSuit="SPADES"
      animatedTrick={{ ...animation, phase, winnerSeat: "WEST", winnerPlayerId: "WEST" }} />);
    expect(container.querySelector(".trick-points-chip")).toHaveAttribute("data-team", "opponent");
  }
  rerender(<TrickPile trick={{ cards: [play("NORTH", "TEN", "CLUBS")], leadPlayerId: "NORTH" }} trumpSuit="SPADES" />);
  expect(container.querySelector(".trick-points-chip")).toHaveAttribute("data-team", "your");
});
