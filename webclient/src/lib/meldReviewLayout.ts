export type MeldLayout = "stacked" | "columns" | "rows" | "columns-rows";
export type MeldDensity = "normal" | "compact";
interface Measurement { cardWidth: number; overflow: number; }

/** Prefer complete descriptions; then maximize actual card size within the viewport. */
export function fitMeldReview(layouts: MeldLayout[], measure: (layout: MeldLayout, density: MeldDensity, width: number) => Measurement) {
  let best: { layout: MeldLayout; density: MeldDensity; width: number; score: number; overflow: number } | undefined;
  for (const density of ["normal", "compact"] as const) {
    for (const layout of layouts) {
      let low = density === "normal" ? 32 : 20, high = 64;
      if (measure(layout, density, low).overflow <= 0) {
        while (high - low > 1) {
          const middle = Math.ceil((low + high) / 2);
          if (measure(layout, density, middle).overflow <= 0) low = middle;
          else high = middle - 1;
        }
        if (measure(layout, density, high).overflow <= 0) low = high;
      }
      const result = measure(layout, density, low);
      if (!best || result.overflow < best.overflow
        || result.overflow === best.overflow && result.cardWidth > best.score + .5) {
        best = { layout, density, width: low, score: result.cardWidth, overflow: result.overflow };
      }
    }
    if (best && best.overflow <= 0) break;
  }
  return best;
}
