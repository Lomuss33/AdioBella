import type { TableTheme } from "../types";
import type { AccentColor } from "./preferences";

// Table colors own the felt and room; accent colors own both rival identities.
export const TABLE_THEMES = ["GREEN", "TEAL", "DARK_BLUE", "PLUM", "CHERRY_RED", "WOODY_BROWN", "LIGHT_BROWN", "FINE_BLACK"] as const;
export const tablePalettes: Record<TableTheme, { swatch: string; center: string; edge: string; room: string; backdrop: string }> = {
  GREEN: { swatch: "#1c8259", center: "#144b37", edge: "#09261c", room: "#081711", backdrop: "#050e0a" },
  DARK_BLUE: { swatch: "#2462a8", center: "#153864", edge: "#0b1c33", room: "#091321", backdrop: "#050b14" },
  CHERRY_RED: { swatch: "#99223e", center: "#521323", edge: "#280610", room: "#1c050c", backdrop: "#110307" },
  WOODY_BROWN: { swatch: "#6c3b28", center: "#3f2015", edge: "#200e08", room: "#180a06", backdrop: "#0f0603" },
  LIGHT_BROWN: { swatch: "#955a36", center: "#53301c", edge: "#2d170c", room: "#1d0f07", backdrop: "#120904" },
  FINE_BLACK: { swatch: "#39404d", center: "#1d2129", edge: "#0e1015", room: "#0c0d11", backdrop: "#07070a" },
  TEAL: { swatch: "#187e93", center: "#114754", edge: "#08242c", room: "#08171d", backdrop: "#040e13" },
  PLUM: { swatch: "#783594", center: "#431d54", edge: "#210c2b", room: "#18081f", backdrop: "#0e0513" }
};

// Casino materials: lacquer, felt, brass, bone chips, leather and dark metal.
// Rich color stays in the material; white copy never needs a bright color tint.
export const accentPalettes: Record<AccentColor, { swatch: string; trim: string; teamYour: string; teamOpponent: string }> = {
  oxblood: { swatch: "#7d2532", trim: "#af7880", teamYour: "#5c8752", teamOpponent: "#55759e" },
  "bottle-green": { swatch: "#1b5a3c", trim: "#7ca88c", teamYour: "#78598f", teamOpponent: "#977a4d" },
  midnight: { swatch: "#224670", trim: "#7894af", teamYour: "#93596e", teamOpponent: "#6e884e" },
  "antique-brass": { swatch: "#8a7149", trim: "#ae9972", teamYour: "#4e8473", teamOpponent: "#7e5d93" },
  ivory: { swatch: "#bebaad", trim: "#a9a497", teamYour: "#8e5058", teamOpponent: "#497d66" },
  saddle: { swatch: "#7d4428", trim: "#ad856c", teamYour: "#5c8369", teamOpponent: "#75648e" },
  aubergine: { swatch: "#602668", trim: "#a176a4", teamYour: "#94744b", teamOpponent: "#4b807d" },
  graphite: { swatch: "#3c444e", trim: "#8e969e", teamYour: "#537792", teamOpponent: "#966656" }
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
