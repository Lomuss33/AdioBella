export interface PlaybackSettings {
  skipAnimations: boolean;
  speed: "normal" | "fast";
}

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = { skipAnimations: false, speed: "normal" };
export const playbackRate = (speed: PlaybackSettings["speed"]) => speed === "fast" ? 2 : 1;
