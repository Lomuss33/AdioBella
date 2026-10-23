import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
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

test("colors historical players and winners by ownership, and keeps contract outcomes separate", () => {
  const { container } = render(<TerminalLog yourTeamName="The Crown" events={[
    event(1, "PLAY_CARD", { playerName: "Alfred", playerSeat: "NORTH", rank: "ACE", suit: "HEARTS" }),
    event(2, "PLAY_CARD", { playerName: "Nelson", playerSeat: "EAST", rank: "KING", suit: "HEARTS" }),
    event(3, "TRICK_WIN", { winnerPlayerName: "Nelson", winnerSeat: "EAST", team: "High Command", trickPoints: "15" }),
    event(4, "HAND_FAILED", { team: "The Crown", handNumber: "1", handPoints: "20", opponentPoints: "142" }),
    event(5, "GAME_WIN", { winner: "High Command", winningScore: "1001" })
  ]} />);
  expect(screen.getByText("Alfred").closest("[data-team]")).toHaveAttribute("data-team", "your");
  expect([...container.querySelectorAll(".terminal-play-player")].find(e => e.textContent === "Nelson")?.closest("[data-team]"))
    .toHaveAttribute("data-team", "opponent");
  expect(container.querySelector(".terminal-round-winner")).toHaveAttribute("data-team", "opponent");
  expect(container.querySelector(".terminal-hand-result")).toHaveAttribute("data-team", "your");
  expect(container.querySelector(".terminal-hand-contract")).toHaveClass("is-failed");
  expect(container.querySelector(".terminal-game-winner")).toHaveAttribute("data-team", "opponent");
});

test("presents awarded scores separately from contract status and numbers hands without changing source events", () => {
  const hands = [
    event(1, "HAND_PASSED", { team: "The Crown", teamOneName: "The Crown", teamTwoName: "High Command", teamOnePoints: "126", teamTwoPoints: "76", dealerPlayerName: "Alfred", trumpPlayerName: "Nelson", trump: "CLUBS", meldWinner: "High Command", meldPoints: "20" }),
    event(2, "HAND_FAILED", { team: "The Crown", teamOneName: "The Crown", teamTwoName: "High Command", teamOnePoints: "0", teamTwoPoints: "162" })
  ];
  const { container } = render(<TerminalLog events={hands} yourTeamName="The Crown" />);
  expect([...container.querySelectorAll(".terminal-hand-number")].map(e => e.textContent)).toEqual(["Hand 2", "Hand 1"]);
  expect([...container.querySelectorAll(".terminal-hand-score-value")].map(e => e.textContent)).toEqual(["+0", "+162", "+126", "+76"]);
  expect(screen.getByText("Alfred").closest("dl")).toHaveClass("terminal-hand-details");
  expect(screen.getByText("High Command +20 points")).toBeInTheDocument();
  expect(hands[0].payload.handNumber).toBeUndefined();
});

test("lets wheel gestures reach the page from either feed and its scrollbar without moving history", () => {
  render(<TerminalLog events={events} />);
  for (const label of ["Round history", "Match history"]) {
    const pane = screen.getByRole("region", { name: label });
    const thumb = screen.getByRole("scrollbar", { name: label });
    pane.scrollTop = 40;
    for (const target of [pane, thumb, thumb.parentElement!, pane.closest("section")!]) {
      for (const ctrlKey of [false, true]) {
        const wheel = createEvent.wheel(target, { deltaY: 200, ctrlKey, cancelable: true });
        fireEvent(target, wheel);
        expect(wheel.defaultPrevented).toBe(false);
        expect(pane.scrollTop).toBe(40);
      }
    }
  }
});

test("scrolls either history down only at the page bottom, and always leaves upward and zoom gestures native", () => {
  render(<TerminalLog events={events} />);
  const page = document.documentElement;
  const saved = Object.getOwnPropertyDescriptors(page);
  let pageTop = 0;
  Object.defineProperties(page, {
    scrollHeight: { configurable: true, value: 1500 },
    clientHeight: { configurable: true, value: 800 },
    scrollTop: { configurable: true, get: () => pageTop }
  });
  try {
    for (const label of ["Round history", "Match history"]) {
      const pane = screen.getByRole("region", { name: label });
      Object.defineProperties(pane, { clientHeight: { value: 100 }, scrollHeight: { value: 600 } });
      pane.scrollTop = 40;
      pageTop = 0;
      const beforeBottom = createEvent.wheel(pane, { deltaY: 80, cancelable: true });
      fireEvent(pane, beforeBottom);
      expect(beforeBottom.defaultPrevented).toBe(false);
      expect(pane.scrollTop).toBe(40);
      pageTop = 700;
      for (const target of [pane, screen.getByRole("scrollbar", { name: label })]) {
        const down = createEvent.wheel(target, { deltaY: 80, cancelable: true });
        const previous = pane.scrollTop;
        fireEvent(target, down);
        expect(down.defaultPrevented).toBe(true);
        expect(pane.scrollTop).toBe(previous + 12);
        for (const options of [{ deltaY: -80 }, { deltaY: 80, ctrlKey: true }, { deltaY: 80, metaKey: true }]) {
          const native = createEvent.wheel(target, { ...options, cancelable: true });
          fireEvent(target, native);
          expect(native.defaultPrevented).toBe(false);
          expect(pane.scrollTop).toBe(previous + 12);
        }
      }
      const end = createEvent.wheel(pane, { deltaY: 4000, cancelable: true });
      fireEvent(pane, end);
      expect(pane.scrollTop).toBe(500);
      const exhausted = createEvent.wheel(pane, { deltaY: 80, cancelable: true });
      fireEvent(pane, exhausted);
      expect(exhausted.defaultPrevented).toBe(false);
    }
  } finally {
    for (const key of ["scrollHeight", "clientHeight", "scrollTop"]) {
      if (saved[key]) Object.defineProperty(page, key, saved[key]);
      else Reflect.deleteProperty(page, key);
    }
  }
});

test("allows downward touch scrolling at the page bottom while leaving reverse swipes and pinch gestures native", () => {
  render(<TerminalLog events={events} />);
  const pane = screen.getByRole("region", { name: "Round history" });
  Object.defineProperties(pane, { clientHeight: { value: 100 }, scrollHeight: { value: 600 } });
  // The test document has no page overflow, so it is already at the bottom.
  fireEvent.touchStart(pane, { touches: [{ clientY: 200 }] });
  const down = createEvent.touchMove(pane, { touches: [{ clientY: 140 }], cancelable: true });
  fireEvent(pane, down);
  expect(down.defaultPrevented).toBe(true);
  expect(pane.scrollTop).toBe(9);
  const up = createEvent.touchMove(pane, { touches: [{ clientY: 180 }], cancelable: true });
  fireEvent(pane, up);
  expect(up.defaultPrevented).toBe(false);
  expect(pane.scrollTop).toBe(9);
  const pinch = createEvent.touchMove(pane, { touches: [{ clientY: 100 }, { clientY: 200 }], cancelable: true });
  fireEvent(pane, pinch);
  expect(pinch.defaultPrevented).toBe(false);
  expect(pane.scrollTop).toBe(9);
});

test("keeps feed content out of the tab order and leaves page navigation gestures native", () => {
  render(<TerminalLog events={events} />);
  for (const label of ["Round history", "Match history"]) {
    const pane = screen.getByRole("region", { name: label });
    const middleClick = createEvent.mouseDown(pane, { button: 1, cancelable: true });
    fireEvent(pane, middleClick);
    expect(middleClick.defaultPrevented).toBe(false);
    const pageDown = createEvent.keyDown(pane, { key: "PageDown", cancelable: true });
    fireEvent(pane, pageDown);
    expect(pageDown.defaultPrevented).toBe(false);
    expect(pane).not.toHaveAttribute("tabindex");
  }
});

test("preserves a visible history entry when its contents reflow without a new event", () => {
  const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    targets: Element[] = [];
    constructor(callback: ResizeObserverCallback) { observers.push({ callback, targets: this.targets }); }
    observe(target: Element) { this.targets.push(target); }
    unobserve() {}
    disconnect() {}
  };
  try {
    const { unmount } = render(<TerminalLog events={events} />);
    const pane = screen.getByRole("region", { name: "Round history" });
    Object.defineProperties(pane, { clientHeight: { value: 100 }, scrollHeight: { value: 1000 } });
    pane.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
    let reflow = 0;
    const rows = [...pane.querySelectorAll<HTMLElement>("[data-history-key]")];
    rows.forEach((row, index) => { row.getBoundingClientRect = () => new DOMRect(0, index * 100 + reflow - pane.scrollTop, 100, 100); });
    pane.scrollTop = 150;
    fireEvent.scroll(pane);
    reflow = 90;
    act(() => {
      for (const observer of observers.filter(o => o.targets.includes(pane))) observer.callback([], {} as ResizeObserver);
    });
    expect(pane.scrollTop).toBe(240);
    unmount();
  } finally { globalThis.ResizeObserver = original; }
});

test("supports direct scrollbar keys without intercepting browser shortcuts", () => {
  render(<TerminalLog events={events} />);
  const pane = screen.getByRole("region", { name: "Round history" });
  const thumb = screen.getByRole("scrollbar", { name: "Round history" });
  Object.defineProperties(pane, { clientHeight: { value: 100 }, scrollHeight: { value: 600 } });
  Object.defineProperty(thumb.parentElement!, "clientHeight", { value: 100 });
  fireEvent.scroll(pane);
  fireEvent.keyDown(thumb, { key: "End" });
  expect(pane.scrollTop).toBe(500);
  fireEvent.keyDown(thumb, { key: "PageUp" });
  expect(pane.scrollTop).toBe(400);
  const shortcut = createEvent.keyDown(thumb, { key: "Home", ctrlKey: true, cancelable: true });
  fireEvent(thumb, shortcut);
  expect(shortcut.defaultPrevented).toBe(false);
  expect(pane.scrollTop).toBe(400);
  fireEvent.keyDown(thumb, { key: "Home" });
  expect(pane.scrollTop).toBe(0);
});

test("moves history by its captured drag handle, keeps the track inert and releases on cancellation", () => {
  render(<TerminalLog events={events} />);
  const pane = screen.getByRole("region", { name: "Round history" });
  const thumb = screen.getByRole("scrollbar", { name: "Round history" });
  const track = thumb.parentElement!;
  Object.defineProperties(pane, { clientHeight: { value: 100 }, scrollHeight: { value: 600 } });
  Object.defineProperty(track, "clientHeight", { value: 100 });
  track.getBoundingClientRect = () => new DOMRect(0, 0, 26, 100);
  thumb.getBoundingClientRect = () => new DOMRect(2, 0, 22, 40);
  thumb.setPointerCapture = vi.fn();
  thumb.hasPointerCapture = () => true;
  thumb.releasePointerCapture = vi.fn();
  fireEvent.scroll(pane);
  fireEvent.click(track, { clientY: 90 });
  expect(pane.scrollTop).toBe(0);
  const pointer = (type: string, y: number) => {
    const event = new MouseEvent(type, { button: 0, clientY: y, bubbles: true, cancelable: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    fireEvent(thumb, event);
  };
  pointer("pointerdown", 20);
  pointer("pointermove", 80);
  expect(pane.scrollTop).toBe(500);
  expect(thumb).toHaveAttribute("aria-valuenow", "100");
  expect(thumb.setPointerCapture).toHaveBeenCalledWith(1);
  expect(screen.getByRole("button", { name: "Latest" })).toBeInTheDocument();
  pointer("pointercancel", 80);
  expect(thumb).not.toHaveClass("is-dragging");
  expect(thumb.releasePointerCapture).toHaveBeenCalledWith(1);
  pointer("pointermove", 20);
  expect(pane.scrollTop).toBe(500);
});

test("exposes a disabled scrollbar when a feed does not overflow", () => {
  render(<TerminalLog events={[]} />);
  for (const name of ["Round history", "Match history"]) {
    const scrollbar = screen.getByRole("scrollbar", { name });
    expect(scrollbar).toHaveAttribute("aria-disabled", "true");
    expect(scrollbar).toHaveAttribute("tabindex", "-1");
  }
});
