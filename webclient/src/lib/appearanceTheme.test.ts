import { expect, test } from "vitest";
import { ACCENT_COLORS } from "./preferences";
import { accentPalettes, accentVariables, TABLE_THEMES, tablePalettes, tableVariables } from "./appearanceTheme";

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
      for (const team of [accentPalettes[accent].teamYour, accentPalettes[accent].teamOpponent]) {
        // Check the brightest part of an active chevron, not just the panel base.
        const patternedPanel = blend(team, playerPanel, .2);
        expect(contrast(text, patternedPanel)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(secondary, patternedPanel)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(accentVariables(accent)["--ui-team-text"], patternedPanel)).toBeGreaterThanOrEqual(4.5);
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
      expect(contrast(ui["--ui-accent-text"], "#0b141d")).toBeGreaterThanOrEqual(4.5);
      for (const surface of neutralSurfaces) {
        expect(contrast(ui["--ui-accent-text"], surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(ui["--ui-focus"], surface)).toBeGreaterThanOrEqual(3);
        expect(contrast("#c5ced8", surface)).toBeGreaterThanOrEqual(4.5);
      }
      // Exposed player/team text stays legible against every felt palette.
      for (const text of [ui["--ui-accent-text"], ui["--ui-team-text"]]) {
        expect(contrast(text, tablePalettes[theme].center)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(text, tablePalettes[theme].edge)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

function hue(hex: string) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255);
  const max = Math.max(r, g, b), delta = max - Math.min(r, g, b);
  return ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
}
function hueDistance(a: string, b: string) {
  const distance = Math.abs(hue(a) - hue(b));
  return Math.min(distance, 360 - distance);
}

test("each accent owns a distinct rival pair, separate from the accent and readable on every table", () => {
  const pairs = new Set<string>();
  for (const accent of ACCENT_COLORS) {
    const palette = accentPalettes[accent];
    const variables = accentVariables(accent);
    expect(variables["--ui-team-your"]).toBe(palette.teamYour);
    expect(variables["--ui-team-opponent"]).toBe(palette.teamOpponent);
    expect(hueDistance(palette.teamYour, palette.teamOpponent)).toBeGreaterThanOrEqual(100);
    if (accent !== "graphite" && accent !== "ivory") {
      expect(hueDistance(palette.teamYour, palette.swatch)).toBeGreaterThanOrEqual(100);
      expect(hueDistance(palette.teamOpponent, palette.swatch)).toBeGreaterThanOrEqual(100);
    }
    pairs.add(`${palette.teamYour}/${palette.teamOpponent}`);
    for (const color of [variables["--ui-team-text"], variables["--ui-accent-text"]]) {
      for (const theme of TABLE_THEMES) {
        for (const surface of [tablePalettes[theme].center, tablePalettes[theme].edge, "#10171f", "#17212b"]) {
          expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  }
  expect(pairs.size).toBe(ACCENT_COLORS.length);
});

test("every accent and rival palette uses subdued pigments with separate white text", () => {
  for (const accent of ACCENT_COLORS) {
    const palette = accentPalettes[accent];
    const variables = accentVariables(accent);
    expect(variables["--ui-accent-text"]).toBe("#ffffff");
    expect(variables["--ui-team-text"]).toBe("#ffffff");
    for (const pigment of [palette.swatch, palette.trim, palette.teamYour, palette.teamOpponent]) {
      const channels = pigment.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
      const max = Math.max(...channels) / 255, min = Math.min(...channels) / 255;
      const lightness = (max + min) / 2;
      const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
      expect(Math.max(...channels)).toBeLessThanOrEqual(accent === "ivory" ? 190 : 175);
      // Deep lacquer can have richer pigment without becoming a bright tint.
      expect(saturation).toBeLessThanOrEqual(.55);
      if (saturation > .35) expect(lightness).toBeLessThan(.35);
    }
  }
});
