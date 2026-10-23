import { createContext, useContext } from "react";
import { DEFAULT_PLAYBACK_SETTINGS, type PlaybackSettings } from "../lib/playback";

const PlaybackContext = createContext({
  settings: DEFAULT_PLAYBACK_SETTINGS,
  onChange: (_patch: Partial<PlaybackSettings>) => {}
});

export const PlaybackProvider = PlaybackContext.Provider;
export const usePlayback = () => useContext(PlaybackContext);
