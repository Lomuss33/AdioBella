import { useEffect, useSyncExternalStore } from "react";
import { deckCardAsset } from "./deckAssets";
import type { CardStyle } from "./preferences";

type Status = "loading" | "ready" | "failed";
const assets = new Map<string, { status: Status; promise: Promise<boolean> }>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Share decoded faces between the hand, flights, trick pile and popup previews. */
export function loadCardArtwork(src: string): Promise<boolean> {
  const cached = assets.get(src);
  if (cached) return cached.promise;
  let finish!: (ready: boolean) => void;
  const entry = { status: "loading" as Status, promise: new Promise<boolean>(resolve => { finish = resolve; }) };
  assets.set(src, entry);
  const image = new Image();
  const complete = (ready: boolean) => {
    if (entry.status !== "loading") return;
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

export function preloadDeckArtwork(deck: CardStyle) {
  if (deck === "original") return;
  for (const suit of ["HEARTS", "SPADES", "DIAMONDS", "CLUBS"]) {
    for (const rank of ["SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN", "KING", "ACE"]) {
      const src = deckCardAsset(deck, { rank, suit, faceUp: true });
      if (src) void loadCardArtwork(src);
    }
  }
  const back = deckCardAsset(deck, { rank: null, suit: null, faceUp: false });
  if (back) void loadCardArtwork(back);
}
