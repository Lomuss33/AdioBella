import type { Locale } from "./index";
import type { PlayerNameDrafts, TeamNameDrafts } from "../types";

export const defaultNames: Record<Locale, { players: PlayerNameDrafts; teams: TeamNameDrafts }> = {
  en: {
    players: { SOUTH: "Ace", NORTH: "Maverick", WEST: "Raven", EAST: "Fox" },
    teams: { yourTeam: "Trump Royals", enemyTeam: "Midnight Aces" }
  },
  de: {
    players: { SOUTH: "Ass", NORTH: "Fuchs", WEST: "Falke", EAST: "Wolf" },
    teams: { yourTeam: "Trumpfkönige", enemyTeam: "Nachtasse" }
  },
  hr: {
    players: { SOUTH: "As", NORTH: "Majstor", WEST: "Sokol", EAST: "Vuk" },
    teams: { yourTeam: "Kraljevi aduta", enemyTeam: "Noćni asovi" }
  }
};

/** Only empty fields use defaults; saved and typed names are never translated. */
export function resolveNames(locale: Locale, players: PlayerNameDrafts, teams: TeamNameDrafts) {
  const defaults = defaultNames[locale];
  return {
    players: Object.fromEntries(Object.entries(players).map(([seat, name]) =>
      [seat, name.trim() ? name : defaults.players[seat as keyof PlayerNameDrafts]])) as PlayerNameDrafts,
    teams: Object.fromEntries(Object.entries(teams).map(([team, name]) =>
      [team, name.trim() ? name : defaults.teams[team as keyof TeamNameDrafts]])) as TeamNameDrafts
  };
}
