import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { DEAL_HIGHLIGHT_MS } from "../lib/useNewlyDealtCards";
import PlayerHand from "./PlayerHand";
import type { PlayerView } from "../types";
import { PlaybackProvider } from "./PlaybackContext";
import type { PlaybackSettings } from "../lib/playback";

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

test("reserves the full dealt hand during trump selection and enables cards only for play", () => {
  const { container, rerender } = render(<PlayerHand player={player} pendingType="CHOOSE_TRUMP" onPlayCard={() => {}} />);
  expect(container.querySelector(".card-fan-row")).toHaveAttribute("data-layout-count", "8");
  expect(screen.getAllByRole("button").every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  const dealt = { ...player, hand: Array.from({ length: 8 }, (_, i) => ({ ...player.hand[i % 2], label: `card-${i}` })), handSize: 8 };
  rerender(<PlayerHand player={dealt} pendingType="PLAY_CARD" onPlayCard={() => {}} />);
  expect(container.querySelector(".card-fan-row")).toHaveAttribute("data-layout-count", "8");
  expect(screen.getAllByRole("button").every(button => !(button as HTMLButtonElement).disabled)).toBe(true);
});

const opening: PlayerView = { ...player, handSize: 6,
  hand: ["SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN"].map(rank => ({
    rank, suit: "SPADES", label: `${rank}_SPADES`, faceUp: true, playable: true
  }))
};
const additions = [
  { rank: "ACE", suit: "HEARTS", label: "AH", faceUp: true, playable: true },
  { rank: "KING", suit: "DIAMONDS", label: "KD", faceUp: true, playable: true }
];
const completed: PlayerView = { ...opening, handSize: 8,
  hand: [additions[0], opening.hand[5], opening.hand[3], additions[1], opening.hand[1], opening.hand[4], opening.hand[2], opening.hand[0]]
};
const marked = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".hand-card-slot.is-newly-dealt")];
afterEach(() => vi.useRealTimers());

test("shines exactly the two new cards after sorting, without changing their play indices", () => {
  const onPlayCard = vi.fn();
  const { container, rerender } = render(<PlayerHand player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} onPlayCard={onPlayCard} />);
  expect(marked(container)).toHaveLength(0);
  rerender(<PlayerHand player={completed} pendingType="PLAY_CARD" trumpSuit="HEARTS" onPlayCard={onPlayCard} />);
  expect(marked(container).map(node => node.dataset.cardKey)).toEqual(["card-HEARTS-ACE-AH", "card-DIAMONDS-KING-KD"]);
  for (const card of marked(container)) fireEvent.click(card.querySelector("button")!);
  expect(onPlayCard.mock.calls.map(call => call[0])).toEqual([0, 3]);
});

test("expires the shine once without restarting it for meld or play updates", () => {
  vi.useFakeTimers();
  const { container, rerender } = render(<PlayerHand player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} onPlayCard={() => {}} />);
  rerender(<PlayerHand player={completed} pendingType="REPORT_MELDS" trumpSuit="SPADES" onPlayCard={() => {}} />);
  expect(marked(container)).toHaveLength(0);
  expect(screen.getAllByRole("button").every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  act(() => vi.advanceTimersByTime(10_000));
  rerender(<PlayerHand player={completed} pendingType="ACKNOWLEDGE_MELDS" trumpSuit="SPADES" onPlayCard={() => {}} />);
  expect(marked(container)).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(10_000));
  rerender(<PlayerHand player={completed} pendingType="PLAY_CARD" trumpSuit="SPADES" onPlayCard={() => {}} />);
  expect(marked(container)).toHaveLength(2);
  act(() => vi.advanceTimersByTime(DEAL_HIGHLIGHT_MS / 2));
  rerender(<PlayerHand player={{ ...completed }} pendingType="PLAY_CARD" trumpSuit="SPADES" onPlayCard={() => {}} />);
  act(() => vi.advanceTimersByTime(DEAL_HIGHLIGHT_MS / 2));
  expect(marked(container)).toHaveLength(0);
  rerender(<PlayerHand player={{ ...completed }} pendingType="PLAY_CARD" trumpSuit="SPADES" onPlayCard={() => {}} />);
  expect(marked(container)).toHaveLength(0);
});

test("retains the opening hand across skipped bids and a separate trump update", () => {
  const props = { onPlayCard: () => {} };
  const { container, rerender } = render(<PlayerHand {...props} player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} />);
  rerender(<PlayerHand {...props} player={{ ...opening, hand: [...opening.hand].reverse() }} pendingType="NONE" trumpSuit={null} />);
  rerender(<PlayerHand {...props} player={opening} pendingType="NONE" trumpSuit="CLUBS" />);
  expect(marked(container)).toHaveLength(0);
  rerender(<PlayerHand {...props} player={completed} pendingType="ACKNOWLEDGE_MELDS" trumpSuit="CLUBS" />);
  expect(marked(container)).toHaveLength(0);
  rerender(<PlayerHand {...props} player={completed} pendingType="PLAY_CARD" trumpSuit="CLUBS" />);
  expect(marked(container)).toHaveLength(2);
});

test("waits and restarts cleanly if a meld popup arrives after the shine starts", () => {
  vi.useFakeTimers();
  const props = { player: completed, trumpSuit: "HEARTS", onPlayCard: () => {} };
  const { container, rerender } = render(<PlayerHand player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} onPlayCard={() => {}} />);
  rerender(<PlayerHand {...props} pendingType="PLAY_CARD" />);
  act(() => vi.advanceTimersByTime(400));
  rerender(<PlayerHand {...props} pendingType="ACKNOWLEDGE_MELDS" />);
  expect(marked(container)).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(10_000));
  rerender(<PlayerHand {...props} pendingType="PLAY_CARD" />);
  expect(marked(container)).toHaveLength(2);
  act(() => vi.advanceTimersByTime(DEAL_HIGHLIGHT_MS));
  expect(marked(container)).toHaveLength(0);
});

test("keeps the longer shine on remaining cards through a quick play and rollback", () => {
  vi.useFakeTimers();
  const props = { pendingType: "PLAY_CARD", trumpSuit: "HEARTS", onPlayCard: () => {} };
  const { container, rerender } = render(<PlayerHand player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} onPlayCard={() => {}} />);
  rerender(<PlayerHand {...props} player={completed} />);
  expect(container.querySelector<HTMLElement>(".card-fan-row")?.style.getPropertyValue("--hand-deal-duration")).toBe(`${DEAL_HIGHLIGHT_MS}ms`);
  act(() => vi.advanceTimersByTime(1500));
  expect(marked(container)).toHaveLength(2);
  rerender(<PlayerHand {...props} player={completed} hiddenIndex={0} />);
  expect(marked(container).map(node => node.dataset.cardKey)).toEqual(["card-DIAMONDS-KING-KD"]);
  rerender(<PlayerHand {...props} player={{ ...completed, hand: completed.hand.slice(1), handSize: 7 }} />);
  expect(marked(container)).toHaveLength(1);
  rerender(<PlayerHand {...props} player={completed} />);
  expect(marked(container)).toHaveLength(2);
  act(() => vi.advanceTimersByTime(DEAL_HIGHLIGHT_MS - 1501));
  expect(marked(container)).toHaveLength(2);
  act(() => vi.advanceTimersByTime(1));
  expect(marked(container)).toHaveLength(0);
});

test("does not confuse an initial full hand or an ordinary rollback with the final deal", () => {
  const props = { onPlayCard: () => {}, pendingType: "PLAY_CARD", trumpSuit: "HEARTS" };
  const { container, rerender } = render(<PlayerHand {...props} player={completed} />);
  expect(marked(container)).toHaveLength(0);
  rerender(<PlayerHand {...props} player={opening} />);
  rerender(<PlayerHand {...props} player={completed} />);
  expect(marked(container)).toHaveLength(0);
});

test("resets when a player changes or a different hand replaces the opening six", () => {
  const props = { onPlayCard: () => {} };
  const { container, rerender } = render(<PlayerHand {...props} player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} />);
  rerender(<PlayerHand {...props} player={{ ...completed, id: "another-player" }} pendingType="PLAY_CARD" trumpSuit="HEARTS" />);
  expect(marked(container)).toHaveLength(0);
  rerender(<PlayerHand {...props} player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} />);
  const different = { ...completed, hand: completed.hand.map(card => ({ ...card, label: `other-${card.label}` })) };
  rerender(<PlayerHand {...props} player={different} pendingType="PLAY_CARD" trumpSuit="HEARTS" />);
  expect(marked(container)).toHaveLength(0);
});

test("cleans up its one expiry timer and remains correct in Strict Mode", () => {
  vi.useFakeTimers();
  const { container, rerender, unmount } = render(<StrictMode><PlayerHand player={opening} pendingType="CHOOSE_TRUMP" trumpSuit={null} onPlayCard={() => {}} /></StrictMode>);
  rerender(<StrictMode><PlayerHand player={completed} pendingType="PLAY_CARD" trumpSuit="HEARTS" onPlayCard={() => {}} /></StrictMode>);
  expect(marked(container)).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test.each([
  { start: "normal", next: "fast", elapsed: 1500, remaining: 650 },
  { start: "fast", next: "normal", elapsed: 400, remaining: 2000 }
] as const)("preserves the dealt-card highlight's progress when switching $start to $next", ({ start, next, elapsed, remaining }) => {
  vi.useFakeTimers();
  const hand = (player: PlayerView, pendingType: string, speed: PlaybackSettings["speed"]) => (
    <PlaybackProvider value={{ settings: { skipAnimations: false, speed }, onChange: () => {} }}>
      <PlayerHand player={player} pendingType={pendingType} trumpSuit={pendingType === "CHOOSE_TRUMP" ? null : "HEARTS"} onPlayCard={() => {}} />
    </PlaybackProvider>
  );
  const { container, rerender } = render(hand(opening, "CHOOSE_TRUMP", start));
  rerender(hand(completed, "PLAY_CARD", start));
  act(() => vi.advanceTimersByTime(elapsed));
  rerender(hand(completed, "PLAY_CARD", next));
  expect(vi.getTimerCount()).toBe(1);
  expect(container.querySelector<HTMLElement>(".card-fan-row")?.style.getPropertyValue("--hand-deal-duration")).toBe(`${DEAL_HIGHLIGHT_MS}ms`);
  act(() => vi.advanceTimersByTime(remaining - 1));
  expect(marked(container)).toHaveLength(2);
  act(() => vi.advanceTimersByTime(1));
  expect(marked(container)).toHaveLength(0);
});
