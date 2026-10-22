import { getHandReflowDelays, getHandReflowDuration } from "./handMotion";

const hand = ["a", "b", "c", "d", "e", "f", "g", "h"];
const without = (index: number) => hand.filter((_, position) => position !== index);

test("starts with the gap's neighbors and leaves the other row moving together", () => {
  expect(getHandReflowDelays(hand, without(0), [4, 4], [3, 4])).toEqual([0, 16, 32, 0, 0, 0, 0]);
  expect(getHandReflowDelays(hand, without(3), [4, 4], [3, 4])).toEqual([32, 16, 0, 0, 0, 0, 0]);
  expect(getHandReflowDelays(hand, without(5), [4, 4], [4, 3])).toEqual([0, 0, 0, 0, 0, 0, 16]);
});

test("closes a middle gap symmetrically and bounds the wave in a long row", () => {
  const five = hand.slice(0, 5);
  expect(getHandReflowDelays(five, five.filter(key => key !== "c"), [5], [4])).toEqual([16, 0, 0, 16]);
  expect(getHandReflowDelays(hand, without(0), [8], [7])).toEqual([0, 16, 32, 48, 48, 48, 48]);
  expect(getHandReflowDelays(hand, without(0), [8], [7]))
    .toEqual(getHandReflowDelays(hand, without(7), [8], [7]).reverse());
});

test("does not delay a card crossing rows or a hand collapsing to one row", () => {
  const seven = hand.slice(0, 7);
  expect(getHandReflowDelays(seven, seven.slice(0, 6), [4, 3], [3, 3])).toEqual([0, 0, 0, 0, 16, 0]);
  const five = hand.slice(0, 5);
  expect(getHandReflowDelays(five, five.slice(1), [3, 2], [4])).toEqual([0, 0, 0, 0]);
});

test("confirmation, rollback and a new deal never replay the removal wave", () => {
  const remaining = without(3);
  expect(getHandReflowDelays(remaining, remaining, [3, 4], [3, 4])).toEqual(remaining.map(() => 0));
  expect(getHandReflowDelays(remaining, hand, [3, 4], [4, 4])).toEqual(hand.map(() => 0));
  expect(getHandReflowDelays(["a", "b"], ["x"], [2], [1])).toEqual([0]);
});

test("motion timing scales with relative travel rather than screen pixel density", () => {
  expect(getHandReflowDuration(40, 160)).toBe(getHandReflowDuration(80, 320));
  expect(getHandReflowDuration(20, 160)).toBeLessThan(getHandReflowDuration(180, 160));
  expect(getHandReflowDuration(0, 160)).toBe(180);
  expect(getHandReflowDuration(1000, 160)).toBe(320);
});

test("closes simultaneous gaps independently in both rows", () => {
  const survivors = hand.filter((_, index) => index !== 1 && index !== 6);
  expect(getHandReflowDelays(hand, survivors, [4, 4], [3, 3])).toEqual([0, 0, 16, 16, 0, 0]);
});

test("starts from the nearest gap when skipped plays are adjacent or separate", () => {
  const adjacent = hand.filter((_, index) => index !== 1 && index !== 2);
  expect(getHandReflowDelays(hand, adjacent, [8], [6])).toEqual([0, 0, 16, 32, 48, 48]);
  const separate = hand.filter((_, index) => index !== 1 && index !== 5);
  expect(getHandReflowDelays(hand, separate, [8], [6])).toEqual([0, 0, 16, 0, 0, 16]);
});
