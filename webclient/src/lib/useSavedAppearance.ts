import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { accentVariables, tablePalettes, tableVariables } from "./appearanceTheme";
import { applyDisplayPreferences, displayPreferencesChanged, loadPreferences, readStorage, writeStorage, type DisplayPreferences, type Preferences } from "./preferences";

/** Apply the player's saved solo-game palette on every non-game route as well. */
export function useSavedAppearance(roomDefaults?: DisplayPreferences, roomId?: string) {
  const [personal, setPersonal] = useState(loadPreferences);
  const [override, setOverride] = useState<{ key: string; patch: Partial<DisplayPreferences> }>();
  const key = roomId && `belot-room-display-v1:${roomId}`;
  const stored = useMemo(() => {
    if (!key) return {};
    try { return JSON.parse(readStorage(key) ?? "{}") as Partial<DisplayPreferences>; }
    catch { return {}; }
  }, [key]);
  const roomPatch = override && override.key === key ? override.patch : stored;
  const preferences = useMemo(() => applyDisplayPreferences(personal, { ...roomDefaults, ...roomPatch }), [personal, roomDefaults, roomPatch]);

  useEffect(() => {
    const update = (event: Event) => setPersonal((event as CustomEvent<Preferences>).detail);
    window.addEventListener(displayPreferencesChanged, update);
    return () => window.removeEventListener(displayPreferencesChanged, update);
  }, []);

  function updateRoomDisplay(patch: Partial<DisplayPreferences>) {
    if (!key) return;
    const next = { ...roomPatch, ...patch };
    writeStorage(key, JSON.stringify(next));
    setOverride({ key, patch: next });
  }
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.tableTheme = preferences.game.tableTheme;
    root.dataset.gameAccent = preferences.visual.accent;
    root.dataset.cardStyle = preferences.visual.cardStyle;
    const variables = {
      ...tableVariables(preferences.game.tableTheme),
      ...accentVariables(preferences.visual.accent),
      "--table-felt-background": "var(--felt-grain), radial-gradient(ellipse at 50% 38%, var(--felt-center), var(--felt-edge))"
    };
    for (const [key, value] of Object.entries(variables)) root.style.setProperty(key, value);
    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = tablePalettes[preferences.game.tableTheme].backdrop;
  }, [preferences]);
  return { preferences, updateRoomDisplay };
}
