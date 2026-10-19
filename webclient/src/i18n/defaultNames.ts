import type { Locale } from "./index";
import type { PlayerNameDrafts, TeamNameDrafts } from "../types";

export const defaultNames: Record<Locale, { players: PlayerNameDrafts; teams: TeamNameDrafts }> = {
  en: {
    players: { SOUTH: "Lionheart", NORTH: "Alfred", WEST: "Wellington", EAST: "Nelson" },
    teams: { yourTeam: "The Crown", enemyTeam: "High Command" }
  },
  de: {
    players: { SOUTH: "Barbarossa", NORTH: "Friedrich II.", WEST: "Bismarck", EAST: "Moltke" },
    teams: { yourTeam: "Kaisergarde", enemyTeam: "Generalstab" }
  },
  hr: {
    players: { SOUTH: "Tomislav", NORTH: "Zvonimir", WEST: "Zrinski", EAST: "Jelačić" },
    teams: { yourTeam: "Kraljevska garda", enemyTeam: "Banski stožer" }
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
