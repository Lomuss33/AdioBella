import { getRemovedHandIndices } from "./handLayout";

/** Close each gap from its neighbors outward, without delaying unaffected rows. */
export function getHandReflowDelays(previousKeys: readonly string[], keys: readonly string[], previousRows: readonly number[], rows: readonly number[]) {
  const removed = getRemovedHandIndices(previousKeys, keys);
  if (!removed || previousRows.length !== rows.length) return keys.map(() => 0);
  const rowIndices = (sizes: readonly number[]) => sizes.flatMap((size, row) => Array<number>(size).fill(row));
  const oldRows = rowIndices(previousRows);
  const nextRows = rowIndices(rows);
  return keys.map((key, index) => {
    const oldIndex = previousKeys.indexOf(key);
    const row = oldRows[oldIndex];
    const gaps = removed.filter(position => oldRows[position] === row);
    if (!gaps.length || nextRows[index] !== row) return 0;
    const distance = Math.min(...gaps.map(position => Math.abs(oldIndex - position)));
    return Math.min(48, Math.max(0, distance - 1) * 16);
  });
}

/** Small shifts settle quickly; row changes get time proportional to their travel. */
export function getHandReflowDuration(distance: number, cardDiagonal: number) {
  return Math.round(Math.min(320, 180 + 100 * Math.max(0, distance) / Math.max(1, cardDiagonal)));
}
