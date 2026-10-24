import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { CARD_STYLES } from "../src/lib/preferences";
import { deckCardAsset } from "../src/lib/deckAssets";

const ranks = ["SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN", "KING", "ACE"];
const suits = ["HEARTS", "SPADES", "DIAMONDS", "CLUBS"];

// A successful JS build is insufficient if the separately served artwork is gone.
// Both production build commands run this check before creating a deployable bundle.
test.each(CARD_STYLES.filter(style => style !== "original"))("%s ships every face and its card back", style => {
  const assets = suits.flatMap(suit => ranks.map(rank => deckCardAsset(style, { suit, rank, faceUp: true })));
  assets.push(deckCardAsset(style, { suit: null, rank: null, faceUp: false }));
  expect(assets).toHaveLength(33);
  for (const asset of assets) {
    expect(asset).not.toBeNull();
    const path = resolve("public", asset.slice(import.meta.env.BASE_URL.length));
    expect(statSync(path).size, asset).toBeGreaterThan(0);
    const data = readFileSync(path);
    if (asset.endsWith(".svg")) expect(data.toString("utf8"), asset).toContain("<svg");
    else expect(["89504e47", "ffd8ffe0", "ffd8ffe1"], asset).toContain(data.subarray(0, 4).toString("hex"));
  }
});

test("deck credits and bundled licenses are retained", () => {
  expect(statSync(resolve("public/assets/decks/ASSET_CREDITS.md")).size).toBeGreaterThan(0);
  for (const style of ["french", "four-color", "heritage", "modern"]) {
    expect(statSync(resolve(`public/assets/decks/${style}/LICENSE`)).size).toBeGreaterThan(0);
  }
});
