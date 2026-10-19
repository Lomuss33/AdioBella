import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { setLanguage } from "../i18n";
import type { GameEvent } from "../types";
import TerminalLog from "./TerminalLog";

beforeEach(() => setLanguage("en"));

function event(sequence: number, eventKind: string, payload: Record<string, string> = {}): GameEvent {
  return { sequence, type: "GAME", message: "", createdAt: "2026-10-19T00:00:00Z", payload: { eventKind, ...payload } };
}
const events = [
  event(1, "PLAY_CARD", { playerName: "First player", rank: "ACE", suit: "HEARTS" }),
  event(2, "PLAY_CARD", { playerName: "Second player", rank: "KING", suit: "HEARTS" }),
  event(3, "TRICK_WIN", { winnerPlayerName: "First player", trickPoints: "15" }),
  event(4, "PLAY_CARD", { playerName: "Third player", rank: "TEN", suit: "SPADES" }),
  event(5, "TRICK_WIN", { winnerPlayerName: "Third player", trickPoints: "10" })
];

test("reverses trick groups without reversing the plays, and keeps the choice for new events", async () => {
  const user = userEvent.setup();
  const { container, rerender } = render(<TerminalLog events={events} />);
  const keys = () => [...container.querySelectorAll(".terminal-round-title")].map(e => e.getAttribute("data-history-key"));
  expect(keys()).toEqual(["game-1-round-2-4", "game-1-round-1-1"]);
  await user.click(screen.getByRole("button", { name: "Show oldest first" }));
  expect(keys()).toEqual(["game-1-round-1-1", "game-1-round-2-4"]);
  expect([...container.querySelectorAll(".terminal-play-player")].map(e => e.textContent))
    .toEqual(["First player", "Second player", "Third player"]);
  expect(screen.getByRole("button", { name: "Show newest first" })).toHaveAttribute("aria-pressed", "true");
  rerender(<TerminalLog events={[...events, event(6, "PLAY_CARD", { playerName: "Fourth player", rank: "JACK", suit: "CLUBS" })]} />);
  expect(keys()).toEqual(["game-1-round-1-1", "game-1-round-2-4", "game-1-round-3-6"]);
  await user.click(screen.getByRole("button", { name: "Show newest first" }));
  expect(keys()).toEqual(["game-1-round-3-6", "game-1-round-2-4", "game-1-round-1-1"]);
});

test("latest follows the bottom in oldest-first mode and the top in newest-first mode", async () => {
  const user = userEvent.setup();
  const { container } = render(<TerminalLog events={events} />);
  const pane = container.querySelector<HTMLDivElement>("#round-feed-history")!;
  Object.defineProperties(pane, { clientHeight: { value: 100 }, scrollHeight: { value: 600 } });
  await user.click(screen.getByRole("button", { name: "Show oldest first" }));
  expect(pane.scrollTop).toBe(600);
  pane.scrollTop = 0;
  fireEvent.scroll(pane);
  await user.click(screen.getByRole("button", { name: "Latest" }));
  expect(pane.scrollTop).toBe(600);
  await user.click(screen.getByRole("button", { name: "Show newest first" }));
  expect(pane.scrollTop).toBe(0);
});
