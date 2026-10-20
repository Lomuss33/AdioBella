import { fitSharedCards, fitTrickCards } from "./tableCardSizing";

test("shares a narrow screen between larger trick cards and a readable two-row hand", () => {
  const budget = { height: 265, trickWidthLimit: 67, handWidthLimit: 62, handRows: 2, aspectRatio: 1.42, trickSpan: 2.24 };
  const sizes = fitSharedCards(budget);
  expect(sizes.trick).toBeGreaterThan(44);
  expect(sizes.hand).toBeGreaterThan(40);
  expect((sizes.trick * budget.trickSpan + sizes.hand * budget.handRows) * budget.aspectRatio).toBeLessThanOrEqual(budget.height);
});

test("a narrow hand does not force table cards to be equally small", () => {
  const sizes = fitSharedCards({ height: 265, trickWidthLimit: 67, handWidthLimit: 30, handRows: 1, aspectRatio: 1.42, trickSpan: 2.24 });
  expect(sizes.hand).toBe(30);
  expect(sizes.trick).toBe(67);
});

test("gives spare height to the hand when the table reaches its width limit", () => {
  const budget = { height: 300, trickWidthLimit: 40, handWidthLimit: 100, handRows: 2, aspectRatio: 1.56, trickSpan: 2.24 };
  const sizes = fitSharedCards(budget);
  expect(sizes.trick).toBe(40);
  expect(sizes.hand).toBeGreaterThan(40);
  expect((sizes.trick * budget.trickSpan + sizes.hand * budget.handRows) * budget.aspectRatio).toBeLessThanOrEqual(budget.height);
});

test.each([1.42, 1.56, 2])("uses the width of a short trick field without clipping or overlapping cards (ratio %s)", aspectRatio => {
  const space = { width: 272, height: 150, maxCardWidth: 96, aspectRatio, allowSpread: true };
  const layout = fitTrickCards(space);
  const cross = fitTrickCards({ ...space, allowSpread: false });
  const height = layout.cardWidth * aspectRatio;
  expect(layout.cardWidth).toBeGreaterThan(cross.cardWidth * 1.25);
  expect(layout.northX).toBeLessThan(0);
  expect(layout.southX).toBeGreaterThan(0);
  const cards = [
    { x: -layout.offsetX, y: 0 }, { x: layout.northX, y: -layout.offsetY },
    { x: layout.southX, y: layout.offsetY }, { x: layout.offsetX, y: 0 }
  ];
  cards.forEach((card, index) => {
    expect(Math.abs(card.x) + layout.cardWidth / 2).toBeLessThanOrEqual(space.width / 2);
    expect(Math.abs(card.y) + height / 2).toBeLessThanOrEqual(space.height / 2);
    cards.slice(index + 1).forEach(other => {
      expect(Math.abs(card.x - other.x) >= layout.cardWidth + 3.9 || Math.abs(card.y - other.y) >= height + 3.9).toBe(true);
    });
  });
});

test("keeps the centered cross when spreading would not enlarge the cards", () => {
  const layout = fitTrickCards({ width: 272, height: 350, maxCardWidth: 96, aspectRatio: 1.42, allowSpread: true });
  expect(layout.northX).toBe(0);
  expect(layout.southX).toBe(0);
});
