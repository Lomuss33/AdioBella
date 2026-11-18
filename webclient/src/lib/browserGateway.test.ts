import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => vi.restoreAllMocks());

test("a new browser runtime restores the last committed action and replays history", async () => {
  const { browserGateway: first } = await import("./browserGateway");
  const created = await first.createSession();
  await first.updateLobbySettings(created.sessionId, "HARD", { SOUTH: "Lovro", WEST: "West", NORTH: "North", EAST: "East" },
    { yourTeam: "Friends", enemyTeam: "Rivals" }, 1, "SHORT");
  const started = await first.startMatch(created.sessionId);
  const history = await first.getSessionEvents(created.sessionId);
  vi.resetModules(); // Simulate closing the page: no in-memory session registry.
  const { browserGateway: reopened } = await import("./browserGateway");
  expect(await reopened.getSession(created.sessionId)).toEqual(started);
  expect(await reopened.getSessionEvents(created.sessionId)).toEqual(history);
  const received: number[] = [];
  const subscription = reopened.subscribe(created.sessionId, history.at(-1)!.sequence, {
    onOpen() {}, onError() {}, onEvent(event) { received.push(event.sequence); }
  });
  await reopened.chooseTrump(created.sessionId, "HEARTS");
  expect(received.length).toBeGreaterThan(0);
  expect(received[0]).toBe(history.at(-1)!.sequence + 1);
  subscription.close();
});

test("a rematch replaces the single save without overwriting other browser data", async () => {
  localStorage.setItem("unrelated", "keep");
  const { browserGateway: first } = await import("./browserGateway");
  const old = await first.createSession();
  const fresh = await first.createSession();
  expect(fresh.sessionId).not.toBe(old.sessionId);
  vi.resetModules();
  const { browserGateway: reopened } = await import("./browserGateway");
  await expect(reopened.getSession(old.sessionId)).rejects.toMatchObject({ code: "error.session" });
  expect(await reopened.getSession(fresh.sessionId)).toEqual(fresh);
  expect(localStorage.getItem("unrelated")).toBe("keep");
});

test("a broken save can be replaced with a fresh playable session", async () => {
  const { browserGateway, BROWSER_SAVE_KEY } = await import("./browserGateway");
  localStorage.setItem(BROWSER_SAVE_KEY, '{"sessionId":"broken","game":"{}"}');
  await expect(browserGateway.getSession("broken")).rejects.toMatchObject({ code: "error.session" });
  const fresh = await browserGateway.createSession();
  expect((await browserGateway.startMatch(fresh.sessionId)).snapshot.pendingAction.type).toBe("CHOOSE_TRUMP");
});

test("blocked storage does not prevent playing in the current tab", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
  const { browserGateway } = await import("./browserGateway");
  const created = await browserGateway.createSession();
  expect((await browserGateway.startMatch(created.sessionId)).snapshot.pendingAction.type).toBe("CHOOSE_TRUMP");
});
