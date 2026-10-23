/**
 * Card pacing in milliseconds. Tune the two rests independently of travel time:
 * completedTrickHoldMs starts after the last landing; clearTableRestMs starts
 * after collection has finished. Neither rest applies to an unfinished trick.
 */
export const CARD_TIMING = {
  selectionMs: 140,
  leadPlayMs: 260,
  leadPlayPauseMs: 220,
  followingPlayMs: 210,
  followingPlayPauseMs: 150,
  unfinishedTrickHoldMs: 400,
  completedTrickHoldMs: 1000,
  pointsPulseMs: 260,
  collectionMs: 560,
  clearTableRestMs: 420
} as const;

/** Motion character, separate from the time available to read the table. */
export const CARD_MOTION = {
  flightEasing: "cubic-bezier(.22,.75,.25,1)",
  settleEasing: "cubic-bezier(.22,.61,.36,1)",
  landingAt: .82,
  landingApproach: .04,
  landingLiftPx: 1.5,
  landingScale: 1.01,
  landingTiltFactor: 1.5,
  restingTiltDeg: 1.2,
  gatherAt: .34,
  gatherEasing: "cubic-bezier(.3,.7,.2,1)",
  collectEasing: "cubic-bezier(.32,.05,.35,1)",
  packetOffsetPx: 1.5,
  packetTiltDeg: -2,
  collectionStaggerMs: 10,
  collectedScale: .28,
  collectedEndScale: .24,
  collectedTiltDeg: 3,
  fadeAt: .9,
  minimumRetargetMs: 60
} as const;

/** The last card finishes exactly at the logical collection deadline. */
export function collectionMotionTiming(index: number, count: number, totalMs: number) {
  const staggerMs = Math.min(CARD_MOTION.collectionStaggerMs, totalMs / Math.max(1, count));
  return {
    duration: totalMs - Math.max(0, count - 1) * staggerMs,
    delay: index * staggerMs
  };
}
