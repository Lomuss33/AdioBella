import type { GameEvent, GameLength, MatchTargetWins, PlayerNameDrafts, SessionResponse, TeamNameDrafts } from "../types";

export async function createSession(): Promise<SessionResponse> {
  return sendRequest<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ difficulty: "NORMAL" })
  });
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  return sendRequest<SessionResponse>(`/api/sessions/${sessionId}`);
}

export async function getSessionEvents(sessionId: string, afterSequence = 0): Promise<GameEvent[]> {
  return sendRequest<GameEvent[]>(`/api/sessions/${sessionId}/events?afterSequence=${afterSequence}`);
}

export async function startMatch(sessionId: string): Promise<SessionResponse> {
  return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/start`, {
    method: "POST"
  });
}

export async function updatePlayerNames(sessionId: string, playerNamesBySeat: PlayerNameDrafts): Promise<SessionResponse> {
  return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/players`, {
    method: "POST",
    body: JSON.stringify({ playerNamesBySeat })
  });
}

export async function updateLobbySettings(
  sessionId: string,
  difficulty: string,
  playerNamesBySeat: PlayerNameDrafts,
  teamNames: TeamNameDrafts,
  matchTargetWins: MatchTargetWins,
  gameLength: GameLength
): Promise<SessionResponse> {
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
}

export async function chooseTrump(sessionId: string, choice: string): Promise<SessionResponse> {
  return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/trump`, {
    method: "POST",
    body: JSON.stringify({ choice })
  });
}

export async function playCard(sessionId: string, handIndex: number): Promise<SessionResponse> {
  return sendRequest<SessionResponse>(`/api/sessions/${sessionId}/card`, {
    method: "POST",
    body: JSON.stringify({ handIndex })
  });
}

async function sendRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ error: "Request failed." }))) as { error?: string };
    throw new Error(errorBody.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}
