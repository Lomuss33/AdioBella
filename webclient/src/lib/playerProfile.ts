import { readStorage, writeStorage } from "./preferences";

export const PLAYER_PROFILE_KEY = "belot-player-profile-v1";
export const PROFILE_MARKS = ["♠", "♥", "♣", "♦"] as const;
export type ProfileMark = typeof PROFILE_MARKS[number];
export interface PlayerProfile { name: string; mark: ProfileMark; }

export function loadPlayerProfile(): PlayerProfile {
  try {
    const saved: unknown = JSON.parse(readStorage(PLAYER_PROFILE_KEY) ?? "{}");
    if (!saved || typeof saved !== "object") return { name: "", mark: "♠" };
    const profile = saved as Record<string, unknown>;
    return {
      name: typeof profile.name === "string" ? profile.name.slice(0, 24) : "",
      mark: PROFILE_MARKS.includes(profile.mark as ProfileMark) ? profile.mark as ProfileMark : "♠"
    };
  } catch { return { name: "", mark: "♠" }; }
}

export function savePlayerProfile(profile: PlayerProfile) {
  return writeStorage(PLAYER_PROFILE_KEY, JSON.stringify({ name: profile.name.trim().slice(0, 24), mark: profile.mark }));
}
