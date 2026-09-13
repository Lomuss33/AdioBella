import type { GameSettingsDrafts, PlayerNameDrafts, TeamNameDrafts } from "../types";

export interface VisualSettings { cardStyle: "classic" | "modern" | "contrast"; accent: "gold" | "silver" | "copper"; }
export interface Preferences { version: 1; game: GameSettingsDrafts; players: PlayerNameDrafts; teams: TeamNameDrafts; visual: VisualSettings; }
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
  return {
    version: 1,
    game: {
      difficulty: choice(game.difficulty, ["EASY", "NORMAL", "HARD"], "NORMAL"),
      matchTargetWins: choice(game.matchTargetWins, [1, 3, 5], 3),
      gameLength: choice(game.gameLength, ["SHORT", "LONG"], "LONG"),
      tableTheme: choice(game.tableTheme ?? readStorage("belot-table-theme"), ["GREEN", "DARK_BLUE", "CHERRY_RED", "WOODY_BROWN", "FINE_BLACK"], "GREEN")
    },
    players: { SOUTH: name(players.SOUTH, 24), NORTH: name(players.NORTH, 24), WEST: name(players.WEST, 24), EAST: name(players.EAST, 24) },
    teams: { yourTeam: name(teams.yourTeam, 30), enemyTeam: name(teams.enemyTeam, 30) },
    visual: { cardStyle: choice(visual.cardStyle, ["classic", "modern", "contrast"], "classic"), accent: choice(visual.accent, ["gold", "silver", "copper"], "gold") }
  };
}
export function savePreferences(preferences: Preferences) { return writeStorage(PREFERENCES_KEY, JSON.stringify(preferences)); }
