import { expect, test } from "vitest";
import { capitalizeInsertedNameWords } from "./nameCapitalization";

test("handles accented initials and whitespace without rewriting existing capitals", () => {
  const capitalizeNameWords = (value: string, locale: string) => capitalizeInsertedNameWords("", value, locale);
  expect(capitalizeNameWords("  željko\tban jelačić", "hr")).toBe("  Željko\tBan Jelačić");
  expect(capitalizeNameWords("friedrich II. von Preußen", "de")).toBe("Friedrich II. Von Preußen");
  expect(capitalizeNameWords("ALFRED McDONALD", "en")).toBe("ALFRED McDONALD");
  expect(capitalizeNameWords("", "en")).toBe("");
});

test("leaves existing lowercase letters unchanged when preceding characters are deleted", () => {
  expect(capitalizeInsertedNameWords("John", "ohn", "en")).toBe("ohn");
  expect(capitalizeInsertedNameWords("John", "hn", "en")).toBe("hn");
  expect(capitalizeInsertedNameWords("John smith", " smith", "en")).toBe(" smith");
  expect(capitalizeInsertedNameWords("ohn", "ohn smith", "en")).toBe("ohn Smith");
  expect(capitalizeInsertedNameWords("ohn", "john", "en")).toBe("John");
});
