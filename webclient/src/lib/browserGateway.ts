import type { Difficulty, GameEvent, GameLength, MatchTargetWins, PlayerNameDrafts, SessionResponse, TeamNameDrafts, TrumpChoice } from "../types";
import type { GameGateway } from "./gameGateway";
import { GameSession } from "./local-game/gameSession";
import { readStorage, writeStorage, removeStorage } from "./preferences";

const sessions = new Map<string, GameSession>();
export const BROWSER_SAVE_KEY = "belot-browser-save-v1";

function persist(session: GameSession) {
  writeStorage(BROWSER_SAVE_KEY, JSON.stringify({ sessionId: session.id(), game: session.saveGame() }));
}

function newSession(id: string) {
  return new GameSession(id, "NORMAL", undefined, persist);
}

export const browserGateway: GameGateway = {
  async createSession() {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const session = newSession(`browser-session-${id}`);
    // The browser has one current save; rematches replace it.
    persist(session);
    sessions.clear();
    sessions.set(session.id(), session);
    return toSessionResponse(session);
  },

  async getSession(sessionId: string) {
    return toSessionResponse(requireSession(sessionId));
  },

  async getSessionEvents(sessionId: string, afterSequence = 0) {
    return requireSession(sessionId).eventsAfter(afterSequence);
  },

  async startMatch(sessionId: string) {
    const session = requireSession(sessionId);
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
    const session = requireSession(sessionId);
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
    const session = requireSession(sessionId);
    return {
      sessionId,
      snapshot: session.chooseTrump(choice)
    };
  },

  async reportMelds(sessionId: string, declare: boolean) {
    const session = requireSession(sessionId);
    return {
      sessionId,
      snapshot: session.reportMelds(declare)
    };
  },

  async acknowledgeMelds(sessionId: string) {
    const session = requireSession(sessionId);
    return {
      sessionId,
      snapshot: session.acknowledgeMelds()
    };
  },

  async playCard(sessionId: string, handIndex: number, callBela = false) {
    const session = requireSession(sessionId);
    return {
      sessionId,
      snapshot: session.playCard(handIndex, callBela)
    };
  },

  async forfeitGame(sessionId: string) {
    const session = requireSession(sessionId);
    return {
      sessionId,
      snapshot: session.forfeitGame()
    };
  },

  async forfeitMatch(sessionId: string) {
    const session = requireSession(sessionId);
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

function requireSession(sessionId: string) {
  let session = sessions.get(sessionId);
  if (!session) {
    const saved = readStorage(BROWSER_SAVE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.sessionId === sessionId && typeof data.game === "string") {
          const restored = newSession(sessionId);
          restored.restoreGame(data.game);
          sessions.set(sessionId, restored);
          session = restored;
        }
      } catch {
        removeStorage(BROWSER_SAVE_KEY);
      }
    }
  }
  if (!session) {
    throw Object.assign(new Error("Session not found."), { code: "error.session" });
  }
  return session;
}

function toSessionResponse(session: GameSession): SessionResponse {
  return {
    sessionId: session.id(),
    snapshot: session.snapshot()
  };
}
