import { afterEach, expect, test, vi } from "vitest";
import { loadPreferences, PREFERENCES_KEY, savePreferences } from "./preferences";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test("restores appearance, names and next-match settings after a reload", () => {
  const preferences = loadPreferences();
  preferences.players.SOUTH = "Ivana";
  preferences.teams.yourTeam = "Friends";
  preferences.game.difficulty = "HARD";
  preferences.game.tableTheme = "DARK_BLUE";
  preferences.visual = { cardStyle: "contrast", accent: "silver" };
  expect(savePreferences(preferences)).toBe(true);
  expect(loadPreferences()).toEqual(preferences);
});

test("recovers from malformed or invalid stored settings", () => {
  localStorage.setItem(PREFERENCES_KEY, "{broken");
  expect(loadPreferences().game.matchTargetWins).toBe(3);
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, game: { difficulty: "invalid", matchTargetWins: -1 }, players: { SOUTH: "x".repeat(100) }, visual: { accent: "invalid" } }));
  const preferences = loadPreferences();
  expect(preferences.game.difficulty).toBe("NORMAL");
  expect(preferences.game.matchTargetWins).toBe(3);
  expect(preferences.players.SOUTH).toHaveLength(24);
  expect(preferences.visual.accent).toBe("gold");
});

test("keeps settings usable and reports when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  const preferences = loadPreferences();
  expect(preferences.visual.cardStyle).toBe("classic");
  expect(savePreferences(preferences)).toBe(false);
});
