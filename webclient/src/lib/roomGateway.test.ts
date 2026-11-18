import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { invitation, rememberRoom, roomGateway, roomIdFromInput, savedRoomAccess, type RoomAccess } from "./roomGateway";

const id = "afdd2d20-910f-4e8f-852a-bcd1927ce001";
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

test("invite parsing accepts only a room UUID and never copies a member token", () => {
  expect(roomIdFromInput(id)).toBe(id);
  expect(roomIdFromInput(`https://example.com/game/#room=${id}`)).toBe(id);
  expect(roomIdFromInput("../../private")).toBeNull();
  expect(roomIdFromInput("https://example.com/#room=not-a-room")).toBeNull();
  expect(invitation(id)).toContain(`#room=${id}`);
  expect(invitation(id)).not.toContain("token");
});

test("room reads send access in the header, never the URL, and forbid caching", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ roomId: id }) });
  vi.stubGlobal("fetch", fetch);
  await roomGateway.read({ roomId: id, name: "Host", token: "private-token" });
  expect(fetch).toHaveBeenCalledWith(`/api/rooms/${id}`, expect.objectContaining({
    headers: { Authorization: "Bearer private-token" }, cache: "no-store", referrerPolicy: "no-referrer"
  }));
  expect(fetch.mock.calls[0][0]).not.toContain("private-token");
});

test("local membership survives reopening and replaces duplicate room entries", () => {
  const access = { token: "secret", room: { roomId: id, yourSeat: "south", seats: [{ seat: "south", name: "Host", human: true }] } } as RoomAccess;
  expect(rememberRoom(access)).toBe(true);
  expect(rememberRoom({ ...access, token: "replacement" })).toBe(true);
  expect(savedRoomAccess()).toEqual([{ roomId: id, name: "Host", token: "replacement" }]);
});

test("an HTML static-host fallback cannot be mistaken for a room API", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "text/html" }) }));
  await expect(roomGateway.create("Host")).rejects.toMatchObject({ status: 503 });
});
