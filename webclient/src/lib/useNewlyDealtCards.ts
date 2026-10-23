import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HAND_CAPACITY } from "./handLayout";
import { usePlayback } from "../components/PlaybackContext";
import { playbackRate } from "./playback";
import { PlaybackClock } from "./PlaybackClock";

export const DEAL_HIGHLIGHT_MS = 2800;
const NO_CARDS: readonly string[] = [];
interface HandCards { playerId: string; keys: readonly string[] }

/** Remember the opening six: sorting the completed hand must not change which two shine. */
export function useNewlyDealtCards(playerId: string | undefined, cardKeys: readonly string[], trumpSuit: string | null | undefined, pendingType: string | undefined) {
  const { settings } = usePlayback();
  const rate = playbackRate(settings.speed);
  const [clock] = useState(() => new PlaybackClock(rate));
  const openingRef = useRef<HandCards | null>(null);
  const queuedRef = useRef<HandCards | null>(null);
  const ownerRef = useRef(playerId);
  const [highlight, setHighlight] = useState<HandCards | null>(null);
  const cardOrder = cardKeys.join("\0");

  useLayoutEffect(() => {
    const keys = cardOrder ? cardOrder.split("\0") : [];
    if (!playerId || ownerRef.current !== playerId) {
      openingRef.current = null;
      queuedRef.current = null;
      setHighlight(null);
    }
    ownerRef.current = playerId;
    if (!playerId) return;

    const awaitingTrump = pendingType === "CHOOSE_TRUMP" || trumpSuit === null;
    if (awaitingTrump || !keys.length) {
      queuedRef.current = null;
      setHighlight(null);
    }
    if (awaitingTrump && keys.length === HAND_CAPACITY - 2) {
      openingRef.current = { playerId, keys };
      return;
    }

    const opening = openingRef.current;
    if (opening?.playerId === playerId && keys.length === HAND_CAPACITY) {
      const before = new Set(opening.keys);
      const after = new Set(keys);
      const added = keys.filter(key => !before.has(key));
      const completesOpening = before.size === HAND_CAPACITY - 2 && after.size === HAND_CAPACITY
        && opening.keys.every(key => after.has(key)) && added.length === 2;
      if (completesOpening && !awaitingTrump) {
        queuedRef.current = { playerId, keys: added };
        openingRef.current = null;
      } else if (!completesOpening) openingRef.current = null;
    } else if (keys.length !== HAND_CAPACITY - 2) openingRef.current = null;

    if (!awaitingTrump && (pendingType === "REPORT_MELDS" || pendingType === "ACKNOWLEDGE_MELDS") && highlight) {
      if (highlight.playerId === playerId && highlight.keys.every(key => keys.includes(key))) queuedRef.current = highlight;
      setHighlight(null);
    }
    const queued = queuedRef.current;
    if (queued && !queued.keys.every(key => keys.includes(key))) queuedRef.current = null;
    else if (queued && pendingType === "PLAY_CARD") {
      // Meld declaration/review may stay open for any length of time. Start the
      // highlight's clock only once those popups have gone and play resumes.
      setHighlight(queued);
      queuedRef.current = null;
    }
  }, [playerId, cardOrder, trumpSuit, pendingType, highlight]);

  useEffect(() => { clock.setRate(rate); }, [clock, rate]);

  useEffect(() => {
    if (!highlight) return;
    clock.schedule(DEAL_HIGHLIGHT_MS, () => setHighlight(null));
    return () => clock.clear();
  }, [highlight, clock]);

  return highlight && highlight.playerId === playerId ? highlight.keys : NO_CARDS;
}
