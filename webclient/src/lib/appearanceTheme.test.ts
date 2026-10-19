import { expect, test } from "vitest";
import { ACCENT_COLORS } from "./preferences";
import { accentPalettes, accentVariables, TABLE_THEMES, TEAM_COLORS, tablePalettes, tableVariables } from "./appearanceTheme";

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

function blend(foreground: string, background: string, opacity: number) {
  const channels = (hex: string) => hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
  const bg = channels(background);
  return "#" + channels(foreground).map((value, index) =>
    Math.round(value * opacity + bg[index] * (1 - opacity)).toString(16).padStart(2, "0")
  ).join("");
}

test("small accent and secondary text remain readable over the brightest felt and seat patterns", () => {
  for (const theme of TABLE_THEMES) {
    const palette = tablePalettes[theme];
    const dialog = blend(palette.edge, "#10171f", .7);
    const playerPanel = blend(dialog, palette.center, .85);
    for (const accent of ACCENT_COLORS) {
      const text = accentVariables(accent)["--ui-accent-text"];
      const secondary = "#ffffff";
      expect(contrast(text, palette.center)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(secondary, palette.center)).toBeGreaterThanOrEqual(4.5);
      for (const team of [palette.teamYour, palette.teamOpponent]) {
        // Check the brightest part of an active chevron, not just the panel base.
        const patternedPanel = blend(team, playerPanel, .2);
        expect(contrast(text, patternedPanel)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(secondary, patternedPanel)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test("every accent/table combination preserves separate ownership and readable colors", () => {
  const neutralSurfaces = ["#10171f", "#17212b"];
  for (const theme of TABLE_THEMES) {
    const table = tableVariables(theme);
    for (const accent of ACCENT_COLORS) {
      const ui = accentVariables(accent);
      expect(Object.keys(table).some(key => key in ui)).toBe(false);
      const palette = accentPalettes[accent];
      expect(contrast(ui["--ui-accent-fill-text"], ui["--ui-accent-fill"])).toBeGreaterThanOrEqual(4.5);
      const dialog = blend(tablePalettes[theme].edge, "#10171f", .7);
      const leatherAction = blend("#ffffff", blend(palette.swatch, dialog, .48), .03);
      expect(contrast("#f3f3f5", leatherAction)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.text, "#0b141d")).toBeGreaterThanOrEqual(4.5);
      for (const surface of neutralSurfaces) {
        expect(contrast(palette.text, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette.focus, surface)).toBeGreaterThanOrEqual(3);
        expect(contrast("#c5ced8", surface)).toBeGreaterThanOrEqual(4.5);
      }
      // Exposed player/team text stays legible against every felt palette.
      for (const text of ["#ffffff", tablePalettes[theme].teamYour, tablePalettes[theme].teamOpponent]) {
        expect(contrast(text, tablePalettes[theme].center)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(text, tablePalettes[theme].edge)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test("every theme keeps the same bold blue/coral team identity with readable colors", () => {
  const your = TEAM_COLORS.teamYour.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
  const opponent = TEAM_COLORS.teamOpponent.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
  expect(your[2] - your[0]).toBeGreaterThanOrEqual(90);
  expect(opponent[0] - opponent[2]).toBeGreaterThanOrEqual(90);
  const pairs = new Set<string>();
  for (const theme of TABLE_THEMES) {
    const palette = tablePalettes[theme];
    const variables = tableVariables(theme);
    expect(variables["--ui-team-your"]).toBe(palette.teamYour);
    expect(variables["--ui-team-opponent"]).toBe(palette.teamOpponent);
    expect(palette.teamYour).toBe(TEAM_COLORS.teamYour);
    expect(palette.teamOpponent).toBe(TEAM_COLORS.teamOpponent);
    expect(palette.teamYour).not.toBe(palette.teamOpponent);
    pairs.add(`${palette.teamYour}/${palette.teamOpponent}`);
    for (const color of [palette.teamYour, palette.teamOpponent]) {
      for (const surface of [palette.center, palette.edge, "#10171f", "#17212b"]) {
        expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
  expect(pairs.size).toBe(1);
});
