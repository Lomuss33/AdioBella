import type { GameSnapshot } from "../types";
import { GameSession } from "./local-game/gameSession";
import { readStorage, writeStorage } from "./preferences";

export const LEGACY_SOLO_SAVE_KEY = "belot-browser-save-v1";
export const LEGACY_SERVER_SESSION_KEY = "belot-session-id";
const PREFIX = "belot-solo-game-v1:";

type MatchSummary = Pick<GameSnapshot, "phase" | "matchComplete"> & {
  action: GameSnapshot["pendingAction"]["type"];
  score: Pick<GameSnapshot["score"], "difficulty" | "gameTargetPoints" | "teamOneMatchScore" | "teamTwoMatchScore" | "teamOneGamePoints" | "teamTwoGamePoints">;
};

export type SoloGameSummary = MatchSummary & { id: string; name: string; createdAt: number; updatedAt: number };
type SoloSave = SoloGameSummary & { game: string };

function originalCreationDate(game: string, fallback: number) {
  try {
    const timestamp = Date.parse(JSON.parse(game)?.events?.[0]?.createdAt ?? "");
    return Number.isFinite(timestamp) ? timestamp : fallback;
  } catch {
    return fallback;
  }
}

export function readSoloGame(id: string): SoloSave | null {
  try {
    const entry = JSON.parse(readStorage(PREFIX + id) ?? "null") as SoloSave | null;
    return entry?.id === id && typeof entry.game === "string" && typeof entry.name === "string" &&
      Number.isFinite(entry.updatedAt) && !!entry.score ? {
        ...entry,
        createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : originalCreationDate(entry.game, entry.updatedAt)
      } : null;
  } catch {
    return null;
  }
}

export function saveSoloGame(session: GameSession) {
  const id = session.id();
  const previous = readSoloGame(id);
  const updatedAt = Date.now();
  const game = session.saveGame();
  const { phase, matchComplete, pendingAction, score } = session.snapshot();
  const { difficulty, gameTargetPoints, teamOneMatchScore, teamTwoMatchScore, teamOneGamePoints, teamTwoGamePoints } = score;
  const entry: SoloSave = {
    id, name: previous?.name ?? "", createdAt: previous?.createdAt ?? originalCreationDate(game, updatedAt), updatedAt,
    phase, matchComplete, action: pendingAction.type,
    score: { difficulty, gameTargetPoints, teamOneMatchScore, teamTwoMatchScore, teamOneGamePoints, teamTwoGamePoints },
    game
  };
  return writeStorage(PREFIX + id, JSON.stringify(entry));
}

export function migrateSoloGame() {
  try {
    const raw = readStorage(LEGACY_SOLO_SAVE_KEY);
    if (!raw) return;
    const { sessionId, game } = JSON.parse(raw);
    if (typeof sessionId !== "string" || typeof game !== "string") return;
    if (!readSoloGame(sessionId)) {
      const session = new GameSession(sessionId);
      session.restoreGame(game);
      if (!saveSoloGame(session)) return;
    }
    localStorage.removeItem(LEGACY_SOLO_SAVE_KEY);
    localStorage.removeItem("belot-browser-session-id");
  } catch {
    // Keep the source save so a failed import never silently discards it.
  }
}

export function listSoloGames(): SoloGameSummary[] {
  try {
    const ids = Object.keys(localStorage).filter(key => key.startsWith(PREFIX)).map(key => key.slice(PREFIX.length));
    return ids.flatMap(id => {
      const save = readSoloGame(id);
      if (!save) return [];
      const { game: _game, ...summary } = save;
      return [summary];
    }).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

export function renameSoloGame(id: string, name: string) {
  const entry = readSoloGame(id);
  return !!entry && writeStorage(PREFIX + id, JSON.stringify({ ...entry, name: name.trim().slice(0, 40) }));
}

export function deleteSoloGame(id: string) {
  try {
    localStorage.removeItem(PREFIX + id);
    return true;
  } catch {
    return false;
  }
}
