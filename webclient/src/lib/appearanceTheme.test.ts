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

test("every accent/table combination preserves separate ownership and readable colors", () => {
  const neutralSurfaces = ["#10171f", "#17212b"];
  for (const theme of TABLE_THEMES) {
    const table = tableVariables(theme);
    for (const accent of ACCENT_COLORS) {
      const ui = accentVariables(accent);
      expect(Object.keys(table).some(key => key in ui)).toBe(false);
      const palette = accentPalettes[accent];
      expect(contrast(palette.text, "#10161d")).toBeGreaterThanOrEqual(4.5);
      for (const surface of neutralSurfaces) {
        expect(contrast(palette.text, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette.focus, surface)).toBeGreaterThanOrEqual(3);
        expect(contrast("#acb7c3", surface)).toBeGreaterThanOrEqual(4.5);
      }
      // Exposed player/team text stays legible against every felt palette.
      for (const text of ["#edf1f5", "#79dfc0", "#f4c8b6"]) {
        expect(contrast(text, tablePalettes[theme].center)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(text, tablePalettes[theme].edge)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
