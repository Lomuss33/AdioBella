import { afterEach, expect, test, vi } from "vitest";
import { loadPreferences, PREFERENCES_KEY, savePreferences } from "./preferences";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test("starts with the oxblood accent and black felt without saved choices", () => {
  const preferences = loadPreferences();
  expect(preferences.visual.accent).toBe("oxblood");
  expect(preferences.game.tableTheme).toBe("FINE_BLACK");
});

test("restores appearance, names and next-match settings after a reload", () => {
  const preferences = loadPreferences();
  preferences.players.SOUTH = "Ivana";
  preferences.teams.yourTeam = "Friends";
  preferences.game.difficulty = "HARD";
  preferences.game.tableTheme = "DARK_BLUE";
  preferences.visual = { cardStyle: "modern", accent: "graphite" };
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
  expect(preferences.visual.accent).toBe("oxblood");
});

test("persists and restores the added accent and felt choices", () => {
  const preferences = loadPreferences();
  for (const [accent, tableTheme] of [["bottle-green", "TEAL"], ["oxblood", "PLUM"]] as const) {
    preferences.visual.accent = accent;
    preferences.game.tableTheme = tableTheme;
    expect(savePreferences(preferences)).toBe(true);
    expect(loadPreferences().visual.accent).toBe(accent);
    expect(loadPreferences().game.tableTheme).toBe(tableTheme);
  }
});

test("maps saved legacy accents to the new casino palette", () => {
  const replacements = { purple: "aubergine", azure: "midnight", jade: "bottle-green", teal: "bottle-green", gold: "antique-brass", silver: "graphite", copper: "saddle", rose: "oxblood" };
  for (const [legacy, accent] of Object.entries(replacements)) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, visual: { accent: legacy } }));
    expect(loadPreferences().visual.accent).toBe(accent);
  }
});

test("keeps settings usable and reports when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  const preferences = loadPreferences();
  expect(preferences.visual.cardStyle).toBe("original");
  expect(savePreferences(preferences)).toBe(false);
});


test("migrates only the untouched legacy name set and keeps explicitly saved names", () => {
  const legacy = { version: 1, players: { SOUTH: "You", NORTH: "Ti", WEST: "Zapad", EAST: "Istok" }, teams: { yourTeam: "Us", enemyTeam: "Them" } };
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(legacy));
  expect(loadPreferences().players).toEqual({ SOUTH: "", NORTH: "", WEST: "", EAST: "" });
  expect(loadPreferences().teams).toEqual({ yourTeam: "", enemyTeam: "" });
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...legacy, players: { ...legacy.players, SOUTH: "Ivana" } }));
  expect(loadPreferences().players.SOUTH).toBe("Ivana");
  expect(loadPreferences().teams).toEqual(legacy.teams);
  savePreferences({ ...loadPreferences(), players: legacy.players });
  expect(loadPreferences().players).toEqual(legacy.players);
});
