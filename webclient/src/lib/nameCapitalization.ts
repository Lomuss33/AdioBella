/** Only inserted letters are candidates; deletions never recase existing text. */
export function capitalizeInsertedNameWords(previous: string, value: string, locale: string) {
  let start = 0;
  while (start < previous.length && start < value.length && previous[start] === value[start]) start++;
  let oldEnd = previous.length, newEnd = value.length;
  while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === value[newEnd - 1]) { oldEnd--; newEnd--; }
  const inserted = value.slice(start, newEnd).replace(/\p{L}/gu, (letter, offset: number) => {
    const position = start + offset;
    return position === 0 || /\s/u.test(value[position - 1]) ? letter.toLocaleUpperCase(locale) : letter;
  });
  return value.slice(0, start) + inserted + value.slice(newEnd);
}
