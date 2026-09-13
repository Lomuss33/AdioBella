import { t, tr, getLocale } from ".";
import type { MessageKey } from "./catalog";
import type { CardView, GameEvent, MeldCombinationView } from "../types";
export function cardDescription(card: Pick<CardView, "rank" | "suit" | "faceUp">) {
  if (!card.faceUp || !card.rank || !card.suit) return t("Hidden card");
  const suit = { SPADES: "spades", HEARTS: "hearts", DIAMONDS: "diamonds", CLUBS: "clubs" }[card.suit];
  return t("cardName", { rank: tr(card.rank), suit: tr(suit ?? card.suit) });
}
export function meldDescription(meld: MeldCombinationView) {
  if (meld.kind === "SEQUENCE") return t("sequence", { count: meld.cards.length });
  const rank = meld.cards[0]?.rank;
  return rank === "JACK" ? t("Four Jacks") : rank === "NINE" ? t("Four Nines") : t("Four of a Kind");
}
export function eventDescription(event: GameEvent) {
  const p = event.payload;
  const kind = p.eventKind;
  if (!kind) return getLocale() === "en" ? event.message : t("event.unknown");
  if (kind === "ERROR") return errorDescription(p.code ?? "error.unknown");
  const keys: Record<string, MessageKey> = {
    TRUMP_SKIP: "event.TRUMP_SKIP", TRUMP_CHOSEN: "event.TRUMP_CHOSEN", PLAY_CARD: "event.PLAY_CARD",
    TRICK_WIN: "event.TRICK_WIN", TRICK_LEAD: "event.TRICK_LEAD", BELA_CALL: "event.BELA_CALL",
    MELDS_DECLARE: "event.MELDS_DECLARE", MELDS_PASS: "event.MELDS_PASS", MELDS_WIN: "event.MELDS_WIN",
    GAME_WIN: "event.GAME_WIN", MATCH_WIN: "event.MATCH_WIN", GAME_FORFEIT: "event.GAME_FORFEIT",
    MATCH_FORFEIT: "event.MATCH_FORFEIT", GAME_START: "event.GAME_START", HAND_PASSED: "event.HAND_PASSED",
    HAND_FAILED: "event.HAND_FAILED", SESSION_CREATED: "event.SESSION_CREATED", PLAYER_NAMES_UPDATED: "event.PLAYER_NAMES_UPDATED", TEAM_NAMES_UPDATED: "event.TEAM_NAMES_UPDATED"
  };
  if (!keys[kind]) return t("event.unknown");
  const suit = { SPADES: "spades", HEARTS: "hearts", DIAMONDS: "diamonds", CLUBS: "clubs" }[p.trump];
  return t(keys[kind], { player: p.playerName ?? p.winnerPlayerName ?? p.dealerPlayerName ?? t("player"),
    winner: p.winner ?? t("team"), team: p.forfeitingTeam ?? p.team ?? t("team"),
    points: Number(p.trickPoints ?? p.points ?? 0), game: Number(p.gameNumber ?? 0), suit: tr(suit ?? p.trump ?? "trump"),
    card: cardDescription({ rank: p.rank, suit: p.suit, faceUp: true }) });
}
export function errorDescription(value: string) {
  const key = value.startsWith("error.") ? value : `error.${value}`;
  const translated = tr(key);
  return translated !== key ? translated : t("error.unknown");
}
export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  if (error && typeof error === "object" && "status" in error && error.status === 404) return "error.session";
  return "error.unknown";
}
