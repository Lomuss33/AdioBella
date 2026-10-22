import { fitMeldReview, getMeldCardColumns, getMeldCardRows } from "./meldReviewLayout";

test.each<[number, number[]]>([
  [1, [1]], [2, [2]], [3, [3]], [4, [4]], [5, [5]],
  [6, [3, 3]], [7, [4, 3]], [8, [4, 4]]
])("balances %i meld cards without changing their order", (count, lengths) => {
  const cards = Array.from({ length: count }, (_, index) => index);
  const rows = getMeldCardRows(cards);
  expect(rows.map(row => row.length)).toEqual(lengths);
  expect(rows.flat()).toEqual(cards);
  expect(getMeldCardColumns(cards.length)).toBe(Math.max(...lengths));
});

test("has no card rows for an empty combination", () => {
  expect(getMeldCardRows([])).toEqual([]);
});

test("keeps all descriptions and the preferred arrangement when full-size cards fit", () => {
  const result = fitMeldReview(["columns", "rows", "stacked"], (_, density, width) => {
    expect(density).toBe("normal");
    return { cardWidth: width, overflow: 0 };
  });
  expect(result).toMatchObject({ layout: "columns", density: "normal", width: 64, overflow: 0 });
});

test("finds the largest card size that fits after removing repeated descriptions", () => {
  const result = fitMeldReview(["rows", "stacked"], (layout, density, width) => ({
    cardWidth: width,
    overflow: density === "normal" ? 90 : Math.max(0, width - (layout === "rows" ? 53 : 40))
  }));
  expect(result).toMatchObject({ layout: "rows", density: "compact", width: 53, overflow: 0 });
});

test("uses real card sizes to keep long sequences readable instead of crowding columns", () => {
  const result = fitMeldReview(["columns", "stacked"], (layout, _, width) => ({
    cardWidth: Math.min(width, layout === "columns" ? 29 : 48), overflow: 0
  }));
  expect(result).toMatchObject({ layout: "stacked", score: 48, density: "normal" });
});

test("minimizes overflow when exceptionally small windows cannot fit even compact content", () => {
  const result = fitMeldReview(["stacked", "rows"], (layout, density, width) => ({
    cardWidth: width, overflow: (density === "normal" ? 200 : 12) + width + (layout === "rows" ? 0 : 10)
  }));
  expect(result).toMatchObject({ layout: "rows", density: "compact", width: 20, overflow: 32 });
});
