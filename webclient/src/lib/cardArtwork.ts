import { useEffect, useState, useSyncExternalStore } from "react";
import { deckCardAsset } from "./deckAssets";
import type { CardStyle } from "./preferences";

type Status = "loading" | "ready" | "failed";
const ARTWORK_LOAD_TIMEOUT_MS = 12000;
interface ArtworkCache {
  assets: Map<string, { status: Status; image: HTMLImageElement; promise: Promise<boolean> }>;
  decks: Map<CardStyle, Promise<void>>;
  listeners: Set<() => void>;
}
// Retain the decoded image itself: a readiness flag alone does not retain its
// resource when the hand, trick and popup mount different image elements.
// Keep the same store through Vite refreshes too, so live preview edits cannot
// reset the selected deck to fallback faces in the middle of a trick.
const hotData = import.meta.hot?.data;
const cache: ArtworkCache = hotData?.cardArtworkCache ?? {
  assets: new Map(), decks: new Map(), listeners: new Set()
};
if (hotData) hotData.cardArtworkCache = cache;
const { assets, decks, listeners } = cache;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Share decoded faces between the hand, flights, trick pile and popup previews. */
export function loadCardArtwork(src: string): Promise<boolean> {
  const cached = assets.get(src);
  if (cached) return cached.promise;
  let finish!: (ready: boolean) => void;
  const image = new Image();
  const entry = { status: "loading" as Status, image, promise: new Promise<boolean>(resolve => { finish = resolve; }) };
  assets.set(src, entry);
  // A background renderer can defer decode() even after a valid image loaded.
  // In that case the visible element can still paint it with decoding="sync".
  // A genuinely missing/stalled download must not block the table indefinitely.
  const timeout = window.setTimeout(() => complete(Boolean(image.complete && image.naturalWidth > 0)), ARTWORK_LOAD_TIMEOUT_MS);
  const complete = (ready: boolean) => {
    if (entry.status !== "loading") return;
    window.clearTimeout(timeout);
    entry.status = ready ? "ready" : "failed";
    finish(ready);
    listeners.forEach(listener => listener());
  };
  image.onload = () => {
    if (typeof image.decode === "function") void image.decode().then(() => complete(true), () => complete(false));
    else complete(true);
  };
  image.onerror = () => complete(false);
  image.src = src;
  return entry.promise;
}

export function useCardArtwork(src: string | null) {
  const status = useSyncExternalStore(subscribe, () => src ? assets.get(src)?.status ?? "loading" : "ready", () => "loading");
  useEffect(() => { if (src) void loadCardArtwork(src); }, [src]);
  return status === "ready";
}

/** Resolve only after every face and back can paint, or has genuinely failed. */
export function preloadDeckArtwork(deck: CardStyle): Promise<void> {
  const cached = decks.get(deck);
  if (cached) return cached;
  if (deck === "original") return Promise.resolve();
  const pending: Promise<boolean>[] = [];
  for (const suit of ["HEARTS", "SPADES", "DIAMONDS", "CLUBS"]) {
    for (const rank of ["SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN", "KING", "ACE"]) {
      const src = deckCardAsset(deck, { rank, suit, faceUp: true });
      if (src) pending.push(loadCardArtwork(src));
    }
  }
  const back = deckCardAsset(deck, { rank: null, suit: null, faceUp: false });
  if (back) pending.push(loadCardArtwork(back));
  const prepared = Promise.all(pending).then(() => undefined);
  decks.set(deck, prepared);
  return prepared;
}

/** Keep the painted deck stable until its replacement is completely prepared.
 * Rapid changes cancel only the handoff, not the shared resource preparation.
 */
export function usePreparedCardStyle(requested: CardStyle) {
  const [prepared, setPrepared] = useState(requested);
  useEffect(() => {
    let active = true;
    void preloadDeckArtwork(requested).then(() => { if (active) setPrepared(requested); });
    return () => { active = false; };
  }, [requested]);
  return prepared;
}
