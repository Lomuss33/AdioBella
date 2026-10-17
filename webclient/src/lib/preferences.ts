import { TABLE_THEMES } from "./appearanceTheme";
import type { GameSettingsDrafts, PlayerNameDrafts, TeamNameDrafts } from "../types";

export type CardStyle = "original" | "modern" | "heritage" | "italian" | "german" | "french" | "four-color";
export const CARD_STYLES: readonly CardStyle[] = ["original", "french", "italian", "german", "modern", "heritage", "four-color"];
export const ACCENT_COLORS = ["purple", "azure", "jade", "gold", "silver", "copper"] as const;
export type AccentColor = typeof ACCENT_COLORS[number];
export interface VisualSettings { cardStyle: CardStyle; accent: AccentColor; }
export interface Preferences { version: 1; namesVersion?: 2; game: GameSettingsDrafts; players: PlayerNameDrafts; teams: TeamNameDrafts; visual: VisualSettings; }
export const PREFERENCES_KEY = "belot-preferences-v1";
export function readStorage(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
export function writeStorage(key: string, value: string) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
export function removeStorage(key: string) { try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ } }
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function choice<T extends string | number>(value: unknown, choices: readonly T[], fallback: T): T { return choices.includes(value as T) ? value as T : fallback; }
function name(value: unknown, max: number) { return typeof value === "string" ? value.slice(0, max) : ""; }
export function loadPreferences(): Preferences {
  let saved: Record<string, unknown> = {};
  try { const parsed = record(JSON.parse(readStorage(PREFERENCES_KEY) ?? "{}")); if (parsed.version === 1) saved = parsed; } catch { /* Start with valid defaults. */ }
  const game = record(saved.game), players = record(saved.players), teams = record(saved.teams), visual = record(saved.visual);
  // Older clients saved the entire engine default set as if it were user input.
  // Only migrate that exact untouched set; ambiguous/custom saved sets stay intact.
  const legacyDefaults = saved.namesVersion !== 2 && isLegacyDefaultNames(players, teams);
  return {
    version: 1,
    namesVersion: 2,
    game: {
      difficulty: choice(game.difficulty, ["EASY", "NORMAL", "HARD"], "NORMAL"),
      matchTargetWins: choice(game.matchTargetWins, [1, 3, 5], 3),
      gameLength: choice(game.gameLength, ["SHORT", "LONG"], "LONG"),
      tableTheme: choice(game.tableTheme ?? readStorage("belot-table-theme"), TABLE_THEMES, "DARK_BLUE")
    },
    players: { SOUTH: legacyDefaults ? "" : name(players.SOUTH, 24), NORTH: legacyDefaults ? "" : name(players.NORTH, 24), WEST: legacyDefaults ? "" : name(players.WEST, 24), EAST: legacyDefaults ? "" : name(players.EAST, 24) },
    teams: { yourTeam: legacyDefaults ? "" : name(teams.yourTeam, 30), enemyTeam: legacyDefaults ? "" : name(teams.enemyTeam, 30) },
    visual: { cardStyle: visual.cardStyle === "classic" ? "original" : choice(visual.cardStyle, CARD_STYLES, "original"), accent: choice(visual.accent, ACCENT_COLORS, "jade") }
  };
}
function isLegacyDefaultNames(players: { SOUTH?: unknown; NORTH?: unknown; WEST?: unknown; EAST?: unknown }, teams: { yourTeam?: unknown; enemyTeam?: unknown }) {
  return players.SOUTH === "You" && players.NORTH === "Ti" && players.WEST === "Zapad" &&
    players.EAST === "Istok" && teams.yourTeam === "Us" && teams.enemyTeam === "Them";
}

export function savePreferences(preferences: Preferences) {
  // Fast Refresh can retain old drafts after the migration code is installed.
  const legacyDefaults = preferences.namesVersion !== 2 && isLegacyDefaultNames(preferences.players, preferences.teams);
  return writeStorage(PREFERENCES_KEY, JSON.stringify({
    ...preferences, namesVersion: 2,
    players: legacyDefaults ? { SOUTH: "", NORTH: "", WEST: "", EAST: "" } : preferences.players,
    teams: legacyDefaults ? { yourTeam: "", enemyTeam: "" } : preferences.teams
  }));
}
