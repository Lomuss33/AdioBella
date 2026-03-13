import type { GameEvent, GameLength, MatchTargetWins, PlayerNameDrafts, SessionResponse, TeamNameDrafts } from "../types";
import { browserGateway } from "./browserGateway";
import { serverGateway } from "./serverGateway";

export interface GameSubscription {
  close(): void;
}

export interface GameGateway {
  createSession(): Promise<SessionResponse>;
  getSession(sessionId: string): Promise<SessionResponse>;
  getSessionEvents(sessionId: string, afterSequence?: number): Promise<GameEvent[]>;
  startMatch(sessionId: string): Promise<SessionResponse>;
  updateLobbySettings(
    sessionId: string,
    difficulty: string,
    playerNamesBySeat: PlayerNameDrafts,
    teamNames: TeamNameDrafts,
    matchTargetWins: MatchTargetWins,
    gameLength: GameLength
  ): Promise<SessionResponse>;
  chooseTrump(sessionId: string, choice: string): Promise<SessionResponse>;
  reportMelds(sessionId: string, declare: boolean): Promise<SessionResponse>;
  acknowledgeMelds(sessionId: string): Promise<SessionResponse>;
  playCard(sessionId: string, handIndex: number, callBela?: boolean): Promise<SessionResponse>;
  forfeitGame(sessionId: string): Promise<SessionResponse>;
  forfeitMatch(sessionId: string): Promise<SessionResponse>;
  subscribe(
    sessionId: string,
    afterSequence: number,
    handlers: {
      onEvent: (event: GameEvent) => void;
      onError: () => void;
    }
  ): GameSubscription;
}

export type GameRuntime = "server" | "browser";

export function getGameRuntime(): GameRuntime {
  return import.meta.env.VITE_GAME_RUNTIME === "browser" ? "browser" : "server";
}

export function shouldPersistSession() {
  return getGameRuntime() === "server";
}

export function getGameGateway(): GameGateway {
  return getGameRuntime() === "browser" ? browserGateway : serverGateway;
}
