import type { Difficulty, GameEvent, GameLength, GameSnapshot, MatchTargetWins, TrumpChoice } from "../types";
import { readStorage, writeStorage } from "./preferences";

export interface RoomView {
  roomId: string;
  revision: number;
  yourSeat: string;
  host: boolean;
  seats: { seat: string; name: string; human: boolean }[];
  snapshot: GameSnapshot;
  events: GameEvent[];
}
export interface RoomAccess { token: string; room: RoomView; }
export interface SavedRoomAccess { roomId: string; token: string; name: string; }
export interface RoomCommand {
  requestId: string; revision: number;
  action: "START" | "TRUMP" | "MELDS" | "ACK" | "CARD" | "FORFEIT_GAME" | "FORFEIT" | "SETTINGS";
  choice?: TrumpChoice; handIndex?: number; declare?: boolean; callBela?: boolean;
  difficulty?: Difficulty; gameLength?: GameLength; matchTargetWins?: MatchTargetWins;
}

const configuredOrigin = (import.meta.env.VITE_MULTIPLAYER_URL ?? "").replace(/\/$/, "");
export const hasRoomServer = Boolean(configuredOrigin) || import.meta.env.DEV || import.meta.env.VITE_GAME_RUNTIME !== "browser";
const STORAGE_KEY = `belot-rooms-v1:${configuredOrigin || "same-origin"}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function roomIdFromInput(input: string): string | null {
  const value = input.trim();
  if (UUID.test(value)) return value.toLowerCase();
  try {
    const id = new URLSearchParams(new URL(value).hash.slice(1)).get("room");
    return id && UUID.test(id) ? id.toLowerCase() : null;
  } catch { return null; }
}

export function invitation(roomId: string): string {
  const url = new URL(window.location.href);
  url.hash = `room=${roomId}`;
  return url.toString();
}

export function savedRoomAccess(): SavedRoomAccess[] {
  try {
    const data: unknown = JSON.parse(readStorage(STORAGE_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter((value): value is SavedRoomAccess =>
      value && UUID.test(value.roomId) && typeof value.token === "string" && typeof value.name === "string").slice(0, 100) : [];
  } catch { return []; }
}

export function rememberRoom(access: RoomAccess): boolean {
  const name = access.room.seats.find(seat => seat.seat === access.room.yourSeat)?.name ?? "";
  const saved = savedRoomAccess().filter(value => value.roomId !== access.room.roomId);
  return writeStorage(STORAGE_KEY, JSON.stringify([{ roomId: access.room.roomId, token: access.token, name }, ...saved].slice(0, 100)));
}

export class RoomError extends Error {
  constructor(public readonly status: number) { super(`Room request failed (${status}).`); }
}

async function request<T>(path: string, token?: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(`${configuredOrigin}/api/rooms${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer"
    });
    if (!response.ok) throw new RoomError(response.status);
    if (!response.headers.get("content-type")?.includes("application/json")) throw new RoomError(503);
    return await response.json() as T;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

export const roomGateway = {
  create: (name: string) => request<RoomAccess>("", undefined, { name }),
  join: (id: string, name: string, seat: string) => request<RoomAccess>(`/${id}/join`, undefined, { name, seat }),
  read: (access: SavedRoomAccess, signal?: AbortSignal) => request<RoomView>(`/${access.roomId}`, access.token, undefined, signal),
  act: (access: SavedRoomAccess, command: RoomCommand) => request<RoomView>(`/${access.roomId}/actions`, access.token, command)
};
