import type { Difficulty, GameEvent, GameLength, MatchTargetWins, PlayerNameDrafts, SessionResponse, TeamNameDrafts, TrumpChoice } from "../types";
import type { GameGateway } from "./gameGateway";
import { GameSession } from "./local-game/gameSession";
import { LEGACY_SOLO_SAVE_KEY, migrateSoloGame, readSoloGame, saveSoloGame } from "./soloGames";
import { readStorage } from "./preferences";

const sessions = new Map<string, { session: GameSession; savedGame?: string }>();
export const BROWSER_SAVE_KEY = LEGACY_SOLO_SAVE_KEY;

export function isSoloSaveCurrent(id: string) {
  const session = sessions.get(id)?.session;
  return !!session && readSoloGame(id)?.game === session.saveGame();
}

function newSession(id: string) {
  const session = new GameSession(id, "NORMAL", undefined, current => {
    const active = sessions.get(id);
    const saved = readSoloGame(id);
    if (active?.savedGame !== undefined && saved?.game !== active.savedGame) {
      current.restoreGame(saved?.game ?? active.savedGame);
      throw saveConflict();
    }
    if (active && saveSoloGame(current)) active.savedGame = current.saveGame();
  });
  return session;
}

export const browserGateway: GameGateway = {
  async createSession() {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const session = newSession(`browser-session-${id}`);
    sessions.set(session.id(), { session, savedGame: saveSoloGame(session) ? session.saveGame() : undefined });
    return toSessionResponse(session);
  },

  async getSession(sessionId: string) {
    return toSessionResponse(requireSession(sessionId));
  },

  async getSessionEvents(sessionId: string, afterSequence = 0) {
    return requireSession(sessionId).eventsAfter(afterSequence);
  },

  async startMatch(sessionId: string) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.startMatch()
    };
  },

  async updateLobbySettings(
    sessionId: string,
    difficulty: Difficulty,
    playerNamesBySeat: PlayerNameDrafts,
    teamNames: TeamNameDrafts,
    matchTargetWins: MatchTargetWins,
    gameLength: GameLength
  ) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.updateLobbySettings(
        difficulty,
        playerNamesBySeat,
        teamNames.yourTeam,
        teamNames.enemyTeam,
        matchTargetWins,
        gameLength
      )
    };
  },

  async chooseTrump(sessionId: string, choice: TrumpChoice) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.chooseTrump(choice)
    };
  },

  async reportMelds(sessionId: string, declare: boolean) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.reportMelds(declare)
    };
  },

  async acknowledgeMelds(sessionId: string) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.acknowledgeMelds()
    };
  },

  async playCard(sessionId: string, handIndex: number, callBela = false) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.playCard(handIndex, callBela)
    };
  },

  async forfeitGame(sessionId: string) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.forfeitGame()
    };
  },

  async forfeitMatch(sessionId: string) {
    const session = requireSession(sessionId, true);
    return {
      sessionId,
      snapshot: session.forfeitMatch()
    };
  },

  subscribe(sessionId: string, afterSequence: number, handlers) {
    const session = requireSession(sessionId);
    handlers.onOpen();
    return session.subscribe(afterSequence, (event: GameEvent) => {
      try {
        handlers.onEvent(event);
      } catch {
        handlers.onError();
      }
    });
  }
};

function requireSession(sessionId: string, forMove = false) {
  const cached = sessions.get(sessionId);
  let saved = readSoloGame(sessionId);
  if (!saved && readStorage(LEGACY_SOLO_SAVE_KEY)) {
    migrateSoloGame();
    saved = readSoloGame(sessionId);
  }
  if (cached && (!saved ? cached.savedGame === undefined : cached.savedGame === saved.game)) return cached.session;
  if (forMove && cached && saved) throw saveConflict();
  let session: GameSession | undefined;
  if (saved) {
    try {
      session = cached?.session ?? newSession(sessionId);
      session.restoreGame(saved.game);
      sessions.set(sessionId, { session, savedGame: saved.game });
    } catch {
      session = undefined;
    }
  }
  if (!session) {
    sessions.delete(sessionId);
    throw Object.assign(new Error("Session not found."), { code: "error.session" });
  }
  return session;
}

function saveConflict() {
  return Object.assign(new Error("Saved game changed in another tab."), { code: "solo.saveConflict" });
}

function toSessionResponse(session: GameSession): SessionResponse {
  return {
    sessionId: session.id(),
    snapshot: session.snapshot()
  };
}
