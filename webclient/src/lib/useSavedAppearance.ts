import { useLayoutEffect, useState } from "react";
import { accentVariables, tablePalettes, tableVariables } from "./appearanceTheme";
import { loadPreferences } from "./preferences";

/** Apply the player's saved solo-game palette on every non-game route as well. */
export function useSavedAppearance() {
  const [preferences] = useState(loadPreferences);
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
  return preferences;
}
