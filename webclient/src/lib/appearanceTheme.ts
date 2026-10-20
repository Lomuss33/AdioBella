import type { TableTheme } from "../types";
import type { AccentColor } from "./preferences";

// Table colors own the felt and room; accent colors own both rival identities.
export const TABLE_THEMES = ["GREEN", "TEAL", "DARK_BLUE", "PLUM", "CHERRY_RED", "WOODY_BROWN", "LIGHT_BROWN", "FINE_BLACK"] as const;
export const tablePalettes: Record<TableTheme, { swatch: string; center: string; edge: string; room: string; backdrop: string }> = {
  GREEN: { swatch: "#15513c", center: "#12392c", edge: "#071e17", room: "#0c1713", backdrop: "#070d0a" },
  DARK_BLUE: { swatch: "#243f68", center: "#182a46", edge: "#0b172a", room: "#0d1522", backdrop: "#070c14" },
  CHERRY_RED: { swatch: "#66263b", center: "#3e1b2a", edge: "#220d17", room: "#1c1016", backdrop: "#11080d" },
  WOODY_BROWN: { swatch: "#492b25", center: "#2d1e1b", edge: "#190e0d", room: "#18110f", backdrop: "#0e0908" },
  LIGHT_BROWN: { swatch: "#79503c", center: "#52392c", edge: "#302018", room: "#221812", backdrop: "#140e0b" },
  FINE_BLACK: { swatch: "#292e38", center: "#20252d", edge: "#10141c", room: "#10131a", backdrop: "#080a10" },
  TEAL: { swatch: "#194c55", center: "#15343c", edge: "#091d23", room: "#0d181d", backdrop: "#070e12" },
  PLUM: { swatch: "#51345f", center: "#30213d", edge: "#1a1025", room: "#17101e", backdrop: "#0d0912" }
};

// Casino materials: lacquer, felt, brass, bone chips, leather and dark metal.
// Rich color stays in the material; white copy never needs a bright color tint.
export const accentPalettes: Record<AccentColor, { swatch: string; trim: string; teamYour: string; teamOpponent: string }> = {
  oxblood: { swatch: "#702d35", trim: "#ad7b7f", teamYour: "#658158", teamOpponent: "#5e7394" },
  "bottle-green": { swatch: "#23513d", trim: "#7f9a87", teamYour: "#78628b", teamOpponent: "#92764f" },
  midnight: { swatch: "#233d59", trim: "#8195a9", teamYour: "#8b5f74", teamOpponent: "#738656" },
  "antique-brass": { swatch: "#897247", trim: "#ab9a78", teamYour: "#567e6e", teamOpponent: "#79628b" },
  ivory: { swatch: "#bcbab2", trim: "#a8a59c", teamYour: "#8a535a", teamOpponent: "#4d7a65" },
  saddle: { swatch: "#75482f", trim: "#a58873", teamYour: "#64806d", teamOpponent: "#73688b" },
  aubergine: { swatch: "#4f3054", trim: "#9c829b", teamYour: "#917450", teamOpponent: "#537c78" },
  graphite: { swatch: "#44494d", trim: "#92999e", teamYour: "#58758b", teamOpponent: "#936b5e" }
};

export function tableVariables(theme: TableTheme): Record<string, string> {
  const palette = tablePalettes[theme];
  return {
    "--felt-center": palette.center, "--felt-edge": palette.edge,
    "--page-top": palette.room, "--page-bottom": palette.backdrop
  };
}
export function accentVariables(accent: AccentColor): Record<string, string> {
  const palette = accentPalettes[accent];
  return {
    "--ui-accent-strong": palette.swatch,
    "--ui-accent": palette.trim,
    "--ui-accent-fill": palette.swatch,
    "--ui-accent-fill-text": accent === "ivory" ? "#191a18" : "#ffffff",
    "--ui-accent-text": "#ffffff",
    "--ui-focus": "#c9cdcf",
    "--ui-team-text": "#ffffff",
    "--ui-team-your": palette.teamYour,
    "--ui-team-opponent": palette.teamOpponent
  };
}
