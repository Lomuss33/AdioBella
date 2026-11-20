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

test("multiple games restore independently without overwriting other browser data", async () => {
  localStorage.setItem("unrelated", "keep");
  const { browserGateway: first } = await import("./browserGateway");
  const old = await first.createSession();
  const started = await first.startMatch(old.sessionId);
  const fresh = await first.createSession();
  expect(fresh.sessionId).not.toBe(old.sessionId);
  vi.resetModules();
  const { browserGateway: reopened } = await import("./browserGateway");
  expect(await reopened.getSession(old.sessionId)).toEqual(started);
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

test("imports an old browser save once without discarding its progress", async () => {
  const { browserGateway, BROWSER_SAVE_KEY } = await import("./browserGateway");
  const { GameSession } = await import("./local-game/gameSession");
  const { listSoloGames, migrateSoloGame } = await import("./soloGames");
  const legacy = new GameSession("legacy-solo");
  legacy.startMatch();
  localStorage.setItem(BROWSER_SAVE_KEY, JSON.stringify({ sessionId: legacy.id(), game: legacy.saveGame() }));
  migrateSoloGame();
  migrateSoloGame();
  expect(listSoloGames().map(game => game.id)).toEqual([legacy.id()]);
  expect((await browserGateway.getSession(legacy.id())).snapshot).toEqual(legacy.snapshot());
  expect(localStorage.getItem(BROWSER_SAVE_KEY)).toBeNull();
});

test("a stale tab cannot apply a move after another tab advances the game", async () => {
  const { browserGateway: original } = await import("./browserGateway");
  const { sessionId } = await original.createSession();
  await original.startMatch(sessionId);
  vi.resetModules();
  const { browserGateway: other } = await import("./browserGateway");
  const advanced = await other.chooseTrump(sessionId, "HEARTS");
  await expect(original.chooseTrump(sessionId, "SPADES")).rejects.toMatchObject({ code: "solo.saveConflict" });
  expect(await original.getSession(sessionId)).toEqual(advanced);
});
