import type { GameEvent, GameLength, MatchTargetWins, PlayerNameDrafts, SessionResponse, TeamNameDrafts } from "../types";
import type { GameGateway } from "./gameGateway";
import { GameSession } from "./local-game/gameSession";

const sessions = new Map<string, GameSession>();
let nextSessionNumber = 1;

export const browserGateway: GameGateway = {
  async createSession() {
    const session = new GameSession(`browser-session-${nextSessionNumber++}`);
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
    difficulty: string,
    playerNamesBySeat: PlayerNameDrafts,
    teamNames: TeamNameDrafts,
    matchTargetWins: MatchTargetWins,
    gameLength: GameLength
  ) {
    const session = requireSession(sessionId);
    return {
      sessionId,
      snapshot: session.updateLobbySettings(
        difficulty as never,
        playerNamesBySeat,
        teamNames.yourTeam,
        teamNames.enemyTeam,
        matchTargetWins,
        gameLength
      )
    };
  },

  async chooseTrump(sessionId: string, choice: string) {
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

  subscribe(sessionId: string, afterSequence: number, handlers) {
    const session = requireSession(sessionId);
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
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }
  return session;
}

function toSessionResponse(session: GameSession): SessionResponse {
  return {
    sessionId: session.id(),
    snapshot: session.snapshot()
  };
}
