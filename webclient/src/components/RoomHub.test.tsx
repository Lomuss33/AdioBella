import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import RoomHub from "./RoomHub";
import { roomGateway, rememberRoom, RoomError, type RoomView } from "../lib/roomGateway";
import { GameSession } from "../lib/local-game/gameSession";
import { SeededRandom } from "../lib/local-game/random";
import { setLanguage } from "../i18n";

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
  fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
  expect(await screen.findByRole("heading", { name: "Waiting room" })).toBeInTheDocument();
  expect((screen.getByLabelText("Invite link") as HTMLInputElement).value).toContain(`#room=${id}`);
  expect((screen.getByLabelText("Invite link") as HTMLInputElement).value).not.toContain("private-host-token");
  expect(roomGateway.create).toHaveBeenCalledWith("Host");
});

test("joins an invitation using the chosen seat", async () => {
  vi.mocked(roomGateway.join).mockResolvedValue({ token: "friend-token", room: { ...fixture(), yourSeat: "north", host: false } });
  render(<RoomHub onBack={() => {}} />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Friend" } });
  fireEvent.change(screen.getByLabelText("Invite link or room ID"), { target: { value: `https://example.com/#room=${id}` } });
  fireEvent.click(screen.getByRole("button", { name: "Join a room" }));
  await waitFor(() => expect(roomGateway.join).toHaveBeenCalledWith(id, "Friend", "north"));
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
  expect(screen.queryByRole("button", { name: "hearts" })).not.toBeInTheDocument();
  expect(roomGateway.act).not.toHaveBeenCalled();
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
