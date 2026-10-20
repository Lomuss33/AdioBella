export const HAND_CAPACITY = 8;

/** Positions use card pitches, so the same layout works at every card size. */
export function getCenteredHandPositions(cardCount: number, columns: number, preferredRowSizes: readonly number[] = []) {
  const count = Math.max(0, Math.min(HAND_CAPACITY, Math.floor(cardCount)));
  if (!count) return [];
  const columnCount = Math.max(1, Math.min(HAND_CAPACITY, Math.floor(columns) || HAND_CAPACITY));
  const rows = Math.ceil(count / columnCount);
  const positions: { column: number; row: number }[] = [];
  const rowSizes = Array.from({ length: rows }, () => Math.floor(count / rows));
  const preferredRows = Array.from({ length: rows }, (_, row) => row)
    .sort((a, b) => (preferredRowSizes[b] ?? 0) - (preferredRowSizes[a] ?? 0));
  for (let extra = 0; extra < count % rows; extra++) rowSizes[preferredRows[extra]]++;

  for (let row = 0; row < rows; row++) {
    const rowSize = rowSizes[row];
    const startColumn = (columnCount - rowSize) / 2;
    for (let column = 0; column < rowSize; column++) {
      positions.push({ column: startColumn + column, row });
    }
  }
  return positions;
}

/** A confirmed play must not close the same gap again after its optimistic hide. */
export function getHandRemoval(previous: readonly string[], current: readonly string[], rowSizes: readonly number[] = [previous.length]) {
  if (previous.length !== current.length + 1) return null;
  const index = previous.findIndex((key, position) => key !== current[position]);
  if (index < 0 || previous.filter((_, position) => position !== index).some((key, position) => key !== current[position])) {
    return null;
  }
  let rowStart = 0;
  const rowSize = rowSizes.find(size => {
    if (index < rowStart + size) return true;
    rowStart += size;
    return false;
  }) ?? previous.length;
  const middle = rowStart + (rowSize - 1) / 2;
  const side = index < middle ? "left" : index > middle ? "right" : "center";
  return { index, side };
}
