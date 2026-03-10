import { toCardPresentation, toSuitPresentation } from "./cardPresentation";

test("maps ace of diamonds to playing-card classes and label", () => {
  const presentation = toCardPresentation({
    suit: "DIAMONDS",
    rank: "ACE",
    label: "AD",
    faceUp: true,
    playable: true
  });

  expect(presentation.className).toContain("rank-a");
  expect(presentation.className).toContain("diams");
  expect(presentation.label).toBe("ad");
  expect(presentation.pipCount).toBe(1);
  expect(presentation.usesPlaceholderArt).toBe(false);
});

test("maps ten of clubs to playing-card classes and label", () => {
  const presentation = toCardPresentation({
    suit: "CLUBS",
    rank: "TEN",
    label: "10C",
    faceUp: true,
    playable: true
  });

  expect(presentation.className).toContain("rank-10");
  expect(presentation.className).toContain("clubs");
  expect(presentation.label).toBe("10c");
  expect(presentation.pipCount).toBe(10);
  expect(presentation.usesPlaceholderArt).toBe(false);
});

test("maps hidden card to back-card presentation", () => {
  const presentation = toCardPresentation({
    suit: null,
    rank: null,
    label: "Hidden",
    faceUp: false,
    playable: false
  });

  expect(presentation.className).toBe("card back");
  expect(presentation.hidden).toBe(true);
  expect(presentation.label).toBe("");
});

test("renders face cards with a single suit mark", () => {
  const presentation = toCardPresentation({
    suit: "HEARTS",
    rank: "QUEEN",
    label: "QH",
    faceUp: true,
    playable: false
  });

  expect(presentation.className).toContain("rank-q");
  expect(presentation.usesPlaceholderArt).toBe(false);
  expect(presentation.pipCount).toBe(1);
});

test("maps suit choice to lowercase presentation", () => {
  const suit = toSuitPresentation("HEARTS");
  expect(suit.className).toBe("hearts");
  expect(suit.label).toBe("hearts");
});
