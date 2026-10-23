import { useLayoutEffect, useRef } from "react";
import type { AnimatedTrickState } from "../types";
import { CARD_MOTION, collectionMotionTiming } from "./cardAnimationConfig";
import { usePlayback } from "../components/PlaybackContext";
import { playbackRate } from "./playback";

type Rect = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** Move the visible card itself. Its resting face is always underneath the animation. */
export function useTrickMotion(animation: AnimatedTrickState | null | undefined, keys: string[]) {
  const { settings } = usePlayback();
  const rate = playbackRate(settings.speed);
  const playbackRef = useRef({ skipAnimations: settings.skipAnimations, rate });
  playbackRef.current = { skipAnimations: settings.skipAnimations, rate };
  const ref = useRef<HTMLDivElement>(null);
  const known = useRef(new Set<string>());
  const running = useRef(new Map<HTMLElement, Animation>());
  const phase = useRef<string>();
  const keyOrder = keys.join("\0");

  useLayoutEffect(() => {
    const pool = ref.current;
    if (!pool) return;
    const table = pool.closest(".table-arena");
    const reduced = playbackRef.current.skipAnimations || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const cards = [...pool.querySelectorAll<HTMLElement>(".trick-card-stack > .playing-card-shell")];
    // Release retained collection effects when the empty-table phase unmounts
    // their faces, including when a new segment starts immediately afterwards.
    running.current.forEach((motion, card) => {
      if (!pool.contains(card)) { motion.cancel(); running.current.delete(card); }
    });
    const animate = (card: HTMLElement, frames: Keyframe[], duration: number, delay = 0, easing: string = CARD_MOTION.flightEasing) => {
      running.current.get(card)?.cancel();
      if (reduced || !card.animate) return;
      const motion = card.animate(frames, { duration, delay, fill: "backwards", easing });
      motion.playbackRate = playbackRef.current.rate;
      running.current.set(card, motion);
      motion.onfinish = () => {
        if (motion.effect?.getTiming().fill !== "both" && running.current.get(card) === motion) running.current.delete(card);
      };
    };
    if (animation?.phase === "collecting" && phase.current !== "collecting") {
      const winner = cards.find((_, index) => keys[index] === animation.winningCardKey);
      const packet = winner?.getBoundingClientRect();
      const seat = animation.winnerSeat?.toLowerCase();
      const target = table?.querySelector(seat === "south" ? ".south-inline-info" : `.seat-${seat}`)?.getBoundingClientRect();
      const durationMs = animation.resolution?.collectDurationMs;
      if (packet && target && durationMs) cards.forEach((card, index) => {
        const from = card.getBoundingClientRect();
        const gatherX = packet.left - from.left + index * CARD_MOTION.packetOffsetPx;
        const gatherY = packet.top - from.top + index * CARD_MOTION.packetOffsetPx;
        const dx = target.left + target.width / 2 - from.left - from.width * CARD_MOTION.collectedScale / 2;
        const dy = target.top + target.height / 2 - from.top - from.height * CARD_MOTION.collectedScale / 2;
        const endInset = (CARD_MOTION.collectedScale - CARD_MOTION.collectedEndScale) / 2;
        const timing = collectionMotionTiming(index, cards.length, durationMs);
        // The four faces gather into a packet before travelling to the winner.
        animate(card, [
          { transform: getComputedStyle(card).transform, opacity: 1, offset: 0, easing: CARD_MOTION.gatherEasing },
          { transform: `translate(${gatherX}px,${gatherY}px) rotate(${CARD_MOTION.packetTiltDeg}deg)`, opacity: 1, offset: CARD_MOTION.gatherAt, easing: CARD_MOTION.collectEasing },
          { transform: `translate(${dx}px,${dy}px) scale(${CARD_MOTION.collectedScale}) rotate(${CARD_MOTION.collectedTiltDeg}deg)`, opacity: 1, offset: CARD_MOTION.fadeAt },
          { transform: `translate(${dx + from.width * endInset}px,${dy + from.height * endInset}px) scale(${CARD_MOTION.collectedEndScale}) rotate(${CARD_MOTION.collectedTiltDeg}deg)`, opacity: 0, offset: 1 }
        ], timing.duration, timing.delay, "linear");
        // Retain the collected end state until the confirmed snapshot takes over.
        running.current.get(card)?.effect?.updateTiming({ fill: "both" });
      });
    } else if (animation?.phase === "placing") {
      cards.forEach((card, index) => {
        if (known.current.has(keys[index]) || index < animation.baseCards.length) return;
        const step = animation.plays[index - animation.baseCards.length];
        if (!step) return;
        const end = card.getBoundingClientRect();
        const seat = step.seat.toLowerCase();
        const panel = table?.querySelector(seat === "south" ? ".player-hand-area" : `.seat-${seat}`)?.getBoundingClientRect();
        const from: Rect = step.origin ?? (panel ? {
          left: panel.left + panel.width / 2 - end.width / 2,
          top: panel.top + panel.height / 2 - end.height / 2, width: end.width, height: end.height
        } : { ...end, left: end.left, top: end.top + (seat === "north" ? -80 : 80) });
        if (!end.width || !end.height) return;
        const dx = from.left - end.left, dy = from.top - end.top;
        const tilt = (step.seat === "WEST" || step.seat === "SOUTH" ? -1 : 1) * CARD_MOTION.restingTiltDeg;
        card.style.transform = `rotate(${tilt}deg)`;
        animate(card, [
          { transform: `translate(${dx}px,${dy}px) scale(${from.width / end.width},${from.height / end.height})`, offset: 0, easing: CARD_MOTION.flightEasing },
          { transform: `translate(${dx * CARD_MOTION.landingApproach}px,${dy * CARD_MOTION.landingApproach - CARD_MOTION.landingLiftPx}px) scale(${CARD_MOTION.landingScale}) rotate(${tilt * CARD_MOTION.landingTiltFactor}deg)`, offset: CARD_MOTION.landingAt, easing: CARD_MOTION.settleEasing },
          { transform: `rotate(${tilt}deg)`, offset: 1 }
        ], step.durationMs, 0, "linear");
      });
    }
    known.current = new Set(keys);
    phase.current = animation?.phase;
  }, [keyOrder, animation?.phase]);

  useLayoutEffect(() => {
    if (settings.skipAnimations) {
      running.current.forEach(motion => motion.cancel());
      running.current.clear();
    } else running.current.forEach(motion => {
      if (motion.playState === "running" || motion.playState === "paused") motion.playbackRate = rate;
    });
  }, [settings.skipAnimations, rate]);

  useLayoutEffect(() => {
    const pool = ref.current;
    if (!pool) return;
    let size = `${pool.clientWidth}:${pool.clientHeight}`;
    const retarget = () => {
      if (phase.current !== "placing") return;
      running.current.forEach((motion, card) => {
        if (motion.playState !== "running") return;
        const before = card.getBoundingClientRect();
        const remaining = Number(motion.effect?.getComputedTiming().endTime ?? 0) - Number(motion.currentTime ?? 0);
        motion.cancel();
        const end = card.getBoundingClientRect();
        if (!end.width || !end.height || !card.animate) return;
        const next = card.animate([
          { transform: `translate(${before.left - end.left}px,${before.top - end.top}px) scale(${before.width / end.width},${before.height / end.height})` },
          { transform: card.style.transform }
        ], { duration: Math.max(CARD_MOTION.minimumRetargetMs, remaining), easing: CARD_MOTION.flightEasing, fill: "backwards" });
        running.current.set(card, next);
        next.playbackRate = playbackRef.current.rate;
        next.onfinish = () => { if (running.current.get(card) === next) running.current.delete(card); };
      });
    };
    const observer = new ResizeObserver(() => {
      const nextSize = `${pool.clientWidth}:${pool.clientHeight}`;
      if (nextSize === size) return;
      size = nextSize;
      retarget();
    });
    observer.observe(pool);
    window.addEventListener("resize", retarget);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", retarget);
      running.current.forEach(motion => motion.cancel());
      running.current.clear();
    };
  }, []);
  return ref;
}
