import { getCenteredHandPositions, getHandRemoval, HAND_CAPACITY } from "./handLayout";

test.each([8, 4])("centers every remaining hand and every row with %i columns", columns => {
  for (let count = 0; count <= HAND_CAPACITY; count++) {
    const positions = getCenteredHandPositions(count, columns);
    expect(positions).toHaveLength(count);
    expect(new Set(positions.map(({ row, column }) => `${row}:${column}`)).size).toBe(count);
    for (const row of new Set(positions.map(position => position.row))) {
      const cards = positions.filter(position => position.row === row);
      const left = Math.min(...cards.map(position => position.column));
      const right = Math.max(...cards.map(position => position.column)) + 1;
      expect((left + right) / 2).toBe(columns / 2);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(columns);
    }
    if (count) {
      const top = Math.min(...positions.map(position => position.row));
      const bottom = Math.max(...positions.map(position => position.row)) + 1;
      expect(top).toBe(0);
      expect(bottom).toBe(Math.ceil(count / columns));
    }
  }
});

test("balances the two landscape rows rather than leaving one isolated card", () => {
  const rows = getCenteredHandPositions(5, 4).map(position => position.row);
  expect(rows.filter(row => row === 0)).toHaveLength(3);
  expect(rows.filter(row => row === 1)).toHaveLength(2);
});

test("keeps a played card's row compact without moving a card across rows unnecessarily", () => {
  const positions = getCenteredHandPositions(7, 4, [3, 4]);
  expect(positions.filter(position => position.row === 0).map(position => position.column)).toEqual([.5, 1.5, 2.5]);
  expect(positions.filter(position => position.row === 1)).toHaveLength(4);
  const hand = ["a", "b", "c", "d", "e", "f", "g", "h"];
  expect(getHandRemoval(hand, hand.filter((_, index) => index !== 2), [4, 4])).toEqual({ index: 2, side: "right" });
  expect(getHandRemoval(hand, hand.filter((_, index) => index !== 5), [4, 4])).toEqual({ index: 5, side: "left" });
});

test("identifies which half closed the gap for every play in a full hand", () => {
  const hand = ["a", "b", "c", "d", "e", "f", "g", "h"];
  hand.forEach((_, index) => {
    expect(getHandRemoval(hand, hand.filter((_, position) => position !== index))).toEqual({
      index, side: index < 4 ? "left" : "right"
    });
  });
  expect(getHandRemoval(["a", "b", "c"], ["a", "c"])).toEqual({ index: 1, side: "center" });
});

test("does not treat confirmation, reordering, a restored card, or a new deal as another play", () => {
  expect(getHandRemoval(["a", "c"], ["a", "c"])).toBeNull();
  expect(getHandRemoval(["a", "b", "c"], ["c", "a"])).toBeNull();
  expect(getHandRemoval(["a", "c"], ["a", "b", "c"])).toBeNull();
  expect(getHandRemoval(["a", "b", "c"], ["x", "y"])).toBeNull();
  expect(getHandRemoval(["a"], [])).toEqual({ index: 0, side: "center" });
});
