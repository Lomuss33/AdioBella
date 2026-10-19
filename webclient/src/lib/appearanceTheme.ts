import type { TableTheme } from "../types";
import type { AccentColor } from "./preferences";

// Table palettes pair the felt and room with two coordinated team colors.
export const TABLE_THEMES = ["GREEN", "DARK_BLUE", "CHERRY_RED", "WOODY_BROWN", "LIGHT_BROWN", "FINE_BLACK"] as const;
export const tablePalettes: Record<TableTheme, { swatch: string; center: string; edge: string; room: string; backdrop: string; teamYour: string; teamOpponent: string }> = {
  // Champagne / periwinkle, glacier / coral, gold / sage,
  // amber / powder blue, ivory / sky, and jade / lilac.
  GREEN: { swatch: "#34745c", center: "#183e32", edge: "#0b211b", room: "#101a15", backdrop: "#080c0b", teamYour: "#e9cf91", teamOpponent: "#b8c8f2" },
  DARK_BLUE: { swatch: "#355b7a", center: "#1b2e40", edge: "#0c1823", room: "#10161d", backdrop: "#080b10", teamYour: "#9ddcf2", teamOpponent: "#f2b6a0" },
  CHERRY_RED: { swatch: "#813b4a", center: "#40232b", edge: "#210f16", room: "#1b1216", backdrop: "#100a0d", teamYour: "#efd09a", teamOpponent: "#b6dfcf" },
  WOODY_BROWN: { swatch: "#3d241a", center: "#302017", edge: "#1b110c", room: "#17100c", backdrop: "#0e0907", teamYour: "#e9c18f", teamOpponent: "#b5cfee" },
  LIGHT_BROWN: { swatch: "#c38b50", center: "#714d2c", edge: "#49301d", room: "#281b10", backdrop: "#191008", teamYour: "#f5e5b9", teamOpponent: "#c5e3f5" },
  FINE_BLACK: { swatch: "#303a36", center: "#252927", edge: "#111513", room: "#151816", backdrop: "#090b0a", teamYour: "#9cdcc5", teamOpponent: "#d4bff0" }
};

// Accents own actions, selected controls and focus. Light tones remain readable
// on the fixed neutral interface; filled actions use dark ink for contrast.
export const accentPalettes: Record<AccentColor, { swatch: string; text: string; focus: string }> = {
  purple: { swatch: "#9a7bd2", text: "#cbb6f2", focus: "#e3d4ff" },
  azure: { swatch: "#63a6d8", text: "#a8d2f0", focus: "#d3edff" },
  jade: { swatch: "#58b48c", text: "#9eddbc", focus: "#d0f5e1" },
  gold: { swatch: "#c2a368", text: "#e0c68e", focus: "#f4e2bc" },
  silver: { swatch: "#a9b6bc", text: "#d1dce0", focus: "#edf4f7" },
  copper: { swatch: "#c4987a", text: "#e2bfa5", focus: "#f5ddc9" }
};

export function tableVariables(theme: TableTheme): Record<string, string> {
  const palette = tablePalettes[theme];
  return {
    "--felt-center": palette.center, "--felt-edge": palette.edge,
    "--page-top": palette.room, "--page-bottom": palette.backdrop,
    "--ui-team-your": palette.teamYour, "--ui-team-opponent": palette.teamOpponent
  };
}
export function accentVariables(accent: AccentColor): Record<string, string> {
  const palette = accentPalettes[accent];
  return { "--ui-accent-strong": palette.swatch, "--ui-accent": palette.text, "--ui-focus": palette.focus };
}
