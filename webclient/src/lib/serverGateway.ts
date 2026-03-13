import type { GameEvent, GameLength, MatchTargetWins, PlayerNameDrafts, SessionResponse, TeamNameDrafts } from "../types";
import type { GameGateway } from "./gameGateway";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const serverGateway: GameGateway = {
  createSession() {
    return sendRequest<SessionResponse>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ difficulty: "NORMAL" })
    });
  },

  getSession(sessionId: string) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}`);
  },

  getSessionEvents(sessionId: string, afterSequence = 0) {
    return sendRequest<GameEvent[]>(`/api/sessions/${sessionId}/events?afterSequence=${afterSequence}`);
  },

  startMatch(sessionId: string) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/start`, {
      method: "POST"
    });
  },

  updateLobbySettings(
    sessionId: string,
    difficulty: string,
    playerNamesBySeat: PlayerNameDrafts,
    teamNames: TeamNameDrafts,
    matchTargetWins: MatchTargetWins,
    gameLength: GameLength
  ) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/settings`, {
      method: "POST",
      body: JSON.stringify({
        difficulty,
        playerNamesBySeat,
        yourTeamName: teamNames.yourTeam,
        enemyTeamName: teamNames.enemyTeam,
        matchTargetWins,
        gameLength
      })
    });
  },

  chooseTrump(sessionId: string, choice: string) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/trump`, {
      method: "POST",
      body: JSON.stringify({ choice })
    });
  },

  reportMelds(sessionId: string, declare: boolean) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/melds`, {
      method: "POST",
      body: JSON.stringify({ declare })
    });
  },

  acknowledgeMelds(sessionId: string) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/melds/ack`, {
      method: "POST",
      body: JSON.stringify({ acknowledged: true })
    });
  },

  playCard(sessionId: string, handIndex: number, callBela = false) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/card`, {
      method: "POST",
      body: JSON.stringify({ handIndex, callBela })
    });
  },

  forfeitGame(sessionId: string) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/forfeit`, {
      method: "POST"
    });
  },

  forfeitMatch(sessionId: string) {
    return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/quit`, {
      method: "POST"
    });
  },

  subscribe(sessionId: string, afterSequence: number, handlers) {
    const source = new EventSource(`/api/sessions/${sessionId}/stream?afterSequence=${afterSequence}`);
    source.onmessage = (message) => {
      handlers.onEvent(JSON.parse(message.data) as GameEvent);
    };
    source.onerror = () => {
      handlers.onError();
    };

    return {
      close() {
        source.close();
      }
    };
  }
};

async function sendRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ error: "Request failed." }))) as { error?: string };
    throw new HttpError(errorBody.error ?? "Request failed.", response.status);
  }

  return (await response.json()) as T;
}
