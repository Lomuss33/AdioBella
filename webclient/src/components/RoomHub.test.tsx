import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import RoomHub from "./RoomHub";
import { roomGateway, rememberRoom, RoomError, type RoomView } from "../lib/roomGateway";
import { GameSession } from "../lib/local-game/gameSession";
import { SeededRandom } from "../lib/local-game/random";
import { setLanguage } from "../i18n";
import { CARD_TIMING } from "../lib/cardAnimationConfig";

vi.mock("../lib/roomGateway", async importOriginal => ({
  ...await importOriginal<typeof import("../lib/roomGateway")>(),
  hasRoomServer: true,
  roomGateway: { create: vi.fn(), join: vi.fn(), read: vi.fn(), act: vi.fn() }
}));

const id = "afdd2d20-910f-4e8f-852a-bcd1927ce001";
function fixture(started = false): RoomView {
  const game = new GameSession("fixture", "NORMAL", new SeededRandom(7));
  if (started) game.startMatch();
  return { roomId: id, revision: started ? 1 : 0, host: true, yourSeat: "south",
    seats: [{ seat: "south", name: "Host", human: true }], snapshot: game.snapshot(), events: game.eventsAfter(0) };
}
beforeEach(() => {
  localStorage.clear(); history.replaceState(null, "", "/"); setLanguage("en"); vi.resetAllMocks();
  vi.mocked(roomGateway.read).mockResolvedValue(fixture());
});
afterEach(() => cleanup());

test("creates a room and exposes a shareable invitation without the seat token", async () => {
  vi.mocked(roomGateway.create).mockResolvedValue({ token: "private-host-token", room: fixture() });
  render(<RoomHub onBack={() => {}} />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Host" } });
  fireEvent.click(screen.getByText("Room settings"));
  fireEvent.click(screen.getByRole("button", { name: "cherry red" }));
  fireEvent.click(screen.getByRole("button", { name: /1001/ }));
  fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
  expect(await screen.findByRole("heading", { name: "Waiting room" })).toBeInTheDocument();
  expect((screen.getByLabelText("Invite link") as HTMLInputElement).value).toContain(`#room=${id}`);
  expect((screen.getByLabelText("Invite link") as HTMLInputElement).value).not.toContain("private-host-token");
  expect(roomGateway.create).toHaveBeenCalledWith("Host", expect.objectContaining({ tableTheme: "CHERRY_RED", cardStyle: "original" }), expect.objectContaining({ gameLength: "LONG" }));
});

test("joins an invitation using the chosen seat", async () => {
  vi.mocked(roomGateway.join).mockResolvedValue({ token: "friend-token", room: { ...fixture(), yourSeat: "north", host: false } });
  render(<RoomHub onBack={() => {}} />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Friend" } });
  fireEvent.click(screen.getByRole("button", { name: "Join a room" }));
  const invite = screen.getByLabelText("Invite link or room ID");
  expect(invite).toHaveFocus();
  fireEvent.change(invite, { target: { value: `https://example.com/#room=${id}` } });
  fireEvent.click(screen.getByRole("button", { name: "Join a room" }));
  await waitFor(() => expect(roomGateway.join).toHaveBeenCalledWith(id, "Friend", "north"));
});

test("returning from an invited room resets the join form and shows saved rooms", async () => {
  rememberRoom({ token: "token", room: fixture() });
  history.replaceState(null, "", `/#room=${id}`);
  render(<RoomHub onBack={() => {}} />);

  await screen.findByRole("heading", { name: "Waiting room" });
  fireEvent.click(screen.getByRole("button", { name: /All my rooms/ }));

  expect(window.location.hash).toBe("#rooms");
  expect(screen.getByRole("button", { name: "Create a room" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  expect(screen.queryByLabelText("Invite link or room ID")).not.toBeInTheDocument();
});

test("room defaults apply on entry and personal changes survive reopening without changing the room", async () => {
  const room: RoomView = { ...fixture(), displayDefaults: {
    tableTheme: "TEAL", accent: "ivory", cardStyle: "french", speed: "fast", skipAnimations: true
  } };
  rememberRoom({ token: "friend-token", room });
  history.replaceState(null, "", `/#room=${id}`);
  vi.mocked(roomGateway.read).mockResolvedValue(room);
  const first = render(<RoomHub onBack={() => {}} />);

  await screen.findByRole("heading", { name: "Waiting room" });
  expect(document.documentElement.dataset.tableTheme).toBe("TEAL");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const settings = within(screen.getByRole("dialog", { name: "Settings" }));
  expect(settings.getByRole("checkbox", { name: "Skip animations" })).toBeChecked();
  fireEvent.click(settings.getByRole("button", { name: "cherry red" }));
  expect(document.documentElement.dataset.tableTheme).toBe("CHERRY_RED");
  expect(roomGateway.act).not.toHaveBeenCalled();
  expect(localStorage.getItem("belot-preferences-v1")).toBeNull();

  first.unmount();
  render(<RoomHub onBack={() => {}} />);
  await screen.findByRole("heading", { name: "Waiting room" });
  expect(document.documentElement.dataset.tableTheme).toBe("CHERRY_RED");
  expect(document.documentElement.dataset.gameAccent).toBe("ivory");
});

test("a late poll cannot replace a newer confirmed move with the old lobby", async () => {
  let resolve!: (view: RoomView) => void;
  vi.mocked(roomGateway.read).mockReturnValue(new Promise(done => { resolve = done; }));
  vi.mocked(roomGateway.create).mockResolvedValue({ token: "token", room: fixture() });
  vi.mocked(roomGateway.act).mockResolvedValue(fixture(true));
  render(<RoomHub onBack={() => {}} />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Host" } });
  fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
  fireEvent.click(await screen.findByRole("button", { name: "Start with these players" }));
  expect(await screen.findByRole("button", { name: "hearts" })).toBeEnabled();
  await act(async () => resolve(fixture()));
  expect(screen.queryByRole("button", { name: "Start with these players" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "hearts" })).toBeEnabled();
});

test("ambiguous network failures retry the same command ID", async () => {
  const room = fixture(true);
  rememberRoom({ token: "token", room });
  history.replaceState(null, "", `/#room=${id}`);
  vi.mocked(roomGateway.read).mockResolvedValue(room);
  vi.mocked(roomGateway.act).mockRejectedValueOnce(new TypeError("Network disconnected")).mockResolvedValueOnce({ ...room, revision: 2 });
  render(<RoomHub onBack={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "hearts" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry last action" }));
  await waitFor(() => expect(roomGateway.act).toHaveBeenCalledTimes(2));
  expect(vi.mocked(roomGateway.act).mock.calls[1][1]).toEqual(vi.mocked(roomGateway.act).mock.calls[0][1]);
});

test("waiting players have no trump or card actions", async () => {
  const room = fixture(true);
  room.snapshot.pendingAction = { ...room.snapshot.pendingAction, type: "NONE", actingPlayerId: "west", legalTrumpChoices: [] };
  rememberRoom({ token: "token", room }); history.replaceState(null, "", `/#room=${id}`);
  vi.mocked(roomGateway.read).mockResolvedValue(room);
  render(<RoomHub onBack={() => {}} />);
  expect(await screen.findByText("Waiting for Zapad")).toBeInTheDocument();
  const toolbar = within(screen.getByRole("navigation", { name: "Main navigation" }));
  expect(toolbar.getByRole("button", { name: "All my rooms" })).toBeEnabled();
  expect(toolbar.getByRole("button", { name: "Refresh" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Skip animations" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "hearts" })).not.toBeInTheDocument();
  expect(roomGateway.act).not.toHaveBeenCalled();
});

test.each(["Fast speed", "Skip animations"])("room playback setting %s applies to an active card selection", async option => {
  const room = fixture(true);
  const player = room.snapshot.players.find(player => player.id === room.yourSeat)!;
  player.hand = [{ suit: "HEARTS", rank: "ACE", label: "ACE_HEARTS", faceUp: true, playable: true }];
  room.snapshot.pendingAction = { ...room.snapshot.pendingAction, type: "PLAY_CARD", legalCardIndices: [0], belaEligibleCardIndices: [] };
  rememberRoom({ token: "token", room });
  history.replaceState(null, "", `/#room=${id}`);
  vi.mocked(roomGateway.read).mockResolvedValue(room);
  vi.mocked(roomGateway.act).mockResolvedValue({ ...room, revision: room.revision + 1 });
  render(<RoomHub onBack={() => {}} />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });

  vi.useFakeTimers();
  try {
    fireEvent.click(card);
    act(() => vi.advanceTimersByTime(CARD_TIMING.selectionMs / 2));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const settings = within(screen.getByRole("dialog", { name: "Settings" }));
    await act(async () => fireEvent.click(settings.getByRole("checkbox", { name: option })));
    if (option === "Fast speed") {
      expect(document.documentElement.dataset.playbackSpeed).toBe("fast");
      act(() => vi.advanceTimersByTime(CARD_TIMING.selectionMs / 4 - 1));
      expect(roomGateway.act).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTimeAsync(1));
    } else {
      expect(document.documentElement.dataset.skipAnimations).toBe("true");
    }
    expect(roomGateway.act).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(CARD_TIMING.selectionMs));
    expect(roomGateway.act).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

test("a stale room is refreshed after a conflict instead of replaying a different move", async () => {
  const room = fixture(true);
  rememberRoom({ token: "token", room }); history.replaceState(null, "", `/#room=${id}`);
  vi.mocked(roomGateway.read).mockResolvedValue(room);
  vi.mocked(roomGateway.act).mockRejectedValue(new RoomError(409));
  render(<RoomHub onBack={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "hearts" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The table changed");
  expect(roomGateway.act).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Retry last action" })).not.toBeInTheDocument();
});
