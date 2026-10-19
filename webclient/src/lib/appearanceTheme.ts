import type { TableTheme } from "../types";
import type { AccentColor } from "./preferences";

// Team identity stays fixed across table themes, accents, and game modes.
// Blue and coral have deliberately different hues, rather than pale variations.
export const TEAM_COLORS = { teamYour: "#77bdfb", teamOpponent: "#f59b8a" } as const;

// Deep colored felt and leather, with the same two clear team markers.
export const TABLE_THEMES = ["GREEN", "TEAL", "DARK_BLUE", "PLUM", "CHERRY_RED", "WOODY_BROWN", "LIGHT_BROWN", "FINE_BLACK"] as const;
export const tablePalettes: Record<TableTheme, { swatch: string; center: string; edge: string; room: string; backdrop: string; teamYour: string; teamOpponent: string }> = {
  GREEN: { ...TEAM_COLORS, swatch: "#15513c", center: "#12392c", edge: "#071e17", room: "#0c1713", backdrop: "#070d0a" },
  DARK_BLUE: { ...TEAM_COLORS, swatch: "#243f68", center: "#182a46", edge: "#0b172a", room: "#0d1522", backdrop: "#070c14" },
  CHERRY_RED: { ...TEAM_COLORS, swatch: "#66263b", center: "#3e1b2a", edge: "#220d17", room: "#1c1016", backdrop: "#11080d" },
  WOODY_BROWN: { ...TEAM_COLORS, swatch: "#492b25", center: "#2d1e1b", edge: "#190e0d", room: "#18110f", backdrop: "#0e0908" },
  LIGHT_BROWN: { ...TEAM_COLORS, swatch: "#79503c", center: "#52392c", edge: "#302018", room: "#221812", backdrop: "#140e0b" },
  FINE_BLACK: { ...TEAM_COLORS, swatch: "#292e38", center: "#20252d", edge: "#10141c", room: "#10131a", backdrop: "#080a10" },
  TEAL: { ...TEAM_COLORS, swatch: "#194c55", center: "#15343c", edge: "#091d23", room: "#0d181d", backdrop: "#070e12" },
  PLUM: { ...TEAM_COLORS, swatch: "#51345f", center: "#30213d", edge: "#1a1025", room: "#17101e", backdrop: "#0d0912" }
};

// Deep dyes belong to surfaces. Text uses a stronger, readable accent hue;
// pale tones are reserved for keyboard focus, rather than washing out copy.
export const accentPalettes: Record<AccentColor, { swatch: string; text: string; focus: string }> = {
  purple: { swatch: "#765298", text: "#c7a0f2", focus: "#e6daf5" },
  azure: { swatch: "#386e9c", text: "#83c4f5", focus: "#d5e5f5" },
  jade: { swatch: "#2c7958", text: "#71d2a7", focus: "#d7ece2" },
  gold: { swatch: "#92703a", text: "#e3bc69", focus: "#e8ddc5" },
  silver: { swatch: "#68778a", text: "#ffffff", focus: "#e4e8ef" },
  copper: { swatch: "#a05f42", text: "#e6ac85", focus: "#ecd8cd" },
  teal: { swatch: "#287a7d", text: "#6dd2d5", focus: "#d2e9e9" },
  rose: { swatch: "#9e4968", text: "#f29bbb", focus: "#f0d5e0" }
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
  return {
    "--ui-accent-strong": palette.swatch,
    "--ui-accent": palette.text,
    "--ui-accent-fill": palette.swatch,
    "--ui-accent-fill-text": "#ffffff",
    "--ui-accent-text": palette.text,
    "--ui-focus": palette.focus
  };
}
