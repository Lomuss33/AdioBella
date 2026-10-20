import { fitTableCards, MODE_TOLERANCE, placeTrickCards, trickFootprint } from "./tableCardSizing";

const base = {
  handCount: 8, handWidth: 600, trickWidth: 450, maxCardWidth: 120,
  aspectRatio: 1.5, handGap: 4, handRowGap: 4, trickGap: 4,
  flow: "stacked" as const, height: 400
};

test("chooses a shared size and the most compact arrangement when both reach the cap", () => {
  const layout = fitTableCards({ ...base, handWidth: 1200, trickWidth: 900, height: 1000 });
  expect(layout).toEqual({ cardWidth: 120, handColumns: 8, handRows: 1, trickLayout: "cross" });
});

test("chooses hand rows from height and width rather than a phone breakpoint", () => {
  expect(fitTableCards({ ...base, height: 300 }).handRows).toBe(1);
  expect(fitTableCards(base).handRows).toBe(2);
  const narrow = { ...base, handWidth: 385, trickWidth: 385 };
  expect(fitTableCards(narrow).handRows).toBe(2);
  expect(fitTableCards({ ...narrow, handCount: 3 }).handRows).toBe(1);
});

test("switches at the calculated fit boundary, with a one-pixel confidence band", () => {
  const oneRow = fitTableCards({ ...base, height: 300 });
  const nextCardWidth = oneRow.cardWidth + .25;
  const edge = base.handRowGap + nextCardWidth * base.aspectRatio * (2 + 1.35);
  expect(fitTableCards({ ...base, height: edge - .001 }).handRows).toBe(1);
  expect(fitTableCards({ ...base, height: edge + .001 }).handRows).toBe(2);
  expect(fitTableCards({ ...base, height: edge + .001, previous: oneRow }).handRows).toBe(1);
  const switched = fitTableCards({ ...base, height: edge + base.aspectRatio * 3.35 * MODE_TOLERANCE + .001, previous: oneRow });
  expect(switched.handRows).toBe(2);
  expect(switched.cardWidth - oneRow.cardWidth).toBeGreaterThan(MODE_TOLERANCE);
});

test("selects the directional cross or the four-column spread from the space", () => {
  const space = { ...base, handCount: 1, handWidth: 1000, trickWidth: 400 };
  expect(fitTableCards({ ...space, height: 300 }).trickLayout).toBe("spread");
  expect(fitTableCards({ ...space, height: 500 }).trickLayout).toBe("cross");
});

test("fits independent landscape lanes with the same card size", () => {
  const layout = fitTableCards({ ...base, flow: "beside", handWidth: 238,
    handHeight: 185, trickWidth: 574, trickHeight: 146 });
  expect(layout.handRows).toBe(2);
  expect(layout.trickLayout).toBe("spread");
  expect(layout.cardWidth).toBe(56.5);
});

test("maximizes a collision-free shared size across decks, counts, gaps and both flows", () => {
  for (const aspectRatio of [1.392, 1.4, 1.42, 1.56, 2]) {
    for (let handCount = 1; handCount <= 8; handCount++) {
      for (const handWidth of [180, 269, 385, 600, 1200]) {
        for (const height of [95, 180, 300, 480, 900]) {
          for (const flow of ["stacked", "beside"] as const) {
            const space = { ...base, handCount, handWidth, trickWidth: handWidth * 1.15,
              height, handHeight: height, trickHeight: height * .8, aspectRatio, flow };
            const result = fitTableCards(space);
            const fits = (width: number, handRows: number, trickLayout: "cross" | "spread") => {
              const columns = Math.ceil(handCount / handRows);
              const handHeight = width * aspectRatio * handRows + (handRows - 1) * space.handRowGap;
              const trick = trickFootprint(trickLayout, width, aspectRatio, space.trickGap);
              return width <= space.maxCardWidth + 1e-7
                && columns * width + (columns - 1) * space.handGap <= space.handWidth + 1e-7
                && trick.width <= space.trickWidth + 1e-7
                && (flow === "stacked" ? handHeight + trick.height <= height + 1e-7
                  : handHeight <= space.handHeight + 1e-7 && trick.height <= space.trickHeight + 1e-7);
            };
            expect(fits(result.cardWidth, result.handRows, result.trickLayout)).toBe(true);
            for (const rows of handCount > 1 ? [1, 2] : [1]) for (const mode of ["cross", "spread"] as const) {
              expect(fits(result.cardWidth + .25, rows, mode)).toBe(false);
            }
            const footprint = trickFootprint(result.trickLayout, result.cardWidth, aspectRatio, space.trickGap);
            const offsets = placeTrickCards(result.trickLayout, result.cardWidth, aspectRatio, space.trickGap, footprint.height + 20);
            const fieldHeight = result.trickLayout === "spread" ? footprint.height + 20 : footprint.height;
            const cards = [{ x: -offsets.offsetX, y: 0 }, { x: offsets.northX, y: -offsets.offsetY },
              { x: offsets.southX, y: offsets.offsetY }, { x: offsets.offsetX, y: 0 }];
            cards.forEach((card, index) => {
              expect(Math.abs(card.x) + result.cardWidth / 2).toBeLessThanOrEqual(footprint.width / 2 + 1e-7);
              expect(Math.abs(card.y) + result.cardWidth * aspectRatio / 2).toBeLessThanOrEqual(fieldHeight / 2 + 1e-7);
              cards.slice(index + 1).forEach(other => {
                expect(Math.abs(card.x - other.x) >= result.cardWidth + space.trickGap - 1e-7
                  || Math.abs(card.y - other.y) >= result.cardWidth * aspectRatio + space.trickGap - 1e-7).toBe(true);
              });
            });
          }
        }
      }
    }
  }
});

test("stays feasible and within one pixel of optimal while resizing in either direction", () => {
  let previous: ReturnType<typeof fitTableCards> | undefined;
  for (const heights of [Array.from({ length: 401 }, (_, i) => 200 + i), Array.from({ length: 401 }, (_, i) => 600 - i)]) {
    for (const height of heights) {
      const space = { ...base, height };
      const optimal = fitTableCards(space);
      const current = fitTableCards({ ...space, previous });
      expect(current.cardWidth).toBeGreaterThanOrEqual(optimal.cardWidth - MODE_TOLERANCE);
      const again = fitTableCards({ ...space, previous: current });
      expect(again).toEqual(current);
      previous = current;
    }
  }
});
