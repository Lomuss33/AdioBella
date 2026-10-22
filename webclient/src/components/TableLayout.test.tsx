import { StrictMode } from "react";
import { render } from "@testing-library/react";
import TableLayout from "./TableLayout";
import type { PlayerView } from "../types";

const player: PlayerView = {
  id: "south", name: "You", seat: "SOUTH", human: true, team: "Your Team",
  hand: ["SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN"].map(rank => ({
    rank, suit: "SPADES", label: rank, faceUp: true, playable: true
  })),
  handSize: 6, matchScore: 0, gamePoints: 0, dealer: false, currentTurn: true
};

const noop = () => {};
const table = (south: PlayerView | undefined, choosingTrump = false) => (
  <StrictMode>
    <TableLayout snapshot={null} playersBySeat={{ SOUTH: south }} onPlayCard={noop}
      errorMessage={null} canForfeitGame={false} canQuitMatch={false}
      onForfeitGame={noop} onQuitMatch={noop} onOpenBook={noop}
      tableActionPanel={choosingTrump ? <div className="belot-dialog-trump" /> : undefined} />
  </StrictMode>
);

beforeEach(() => {
  // Model the grid shrinking from its CSS fallback to the table's resolved size.
  // ResizeObserver stays inactive: the first commit must already be correct.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const element = this;
    const arena = element.closest<HTMLElement>(".table-arena");
    const row = arena?.querySelector<HTMLElement>(".card-fan-row");
    const width = parseFloat(arena?.style.getPropertyValue("--hand-card-max") ?? "") || 100;
    const columns = Number(row?.style.getPropertyValue("--hand-grid-columns")) || 6;
    const rows = Math.ceil(Number(row?.dataset.cardCount ?? 6) / columns);
    const handHeight = Math.max(1, rows) * width * 1.42;
    const rect = (x: number, y: number, w: number, h: number) => new DOMRect(x, y, w, h);
    if (element.classList.contains("table-arena")) return rect(0, 0, 600, 590);
    if (element.classList.contains("arena-status")) return rect(0, 510, 600, 80);
    if (element.classList.contains("arena-play")) return rect(0, 150, 600, 360);
    if (element.classList.contains("player-hand-area")) return rect(0, 400, 600, handHeight + 40);
    if (element.classList.contains("card-fan-row")) return rect(0, 400, 600, handHeight);
    if (element.classList.contains("belot-dialog-trump")) return rect(0, 150, 420, 220);
    if (element.classList.contains("hand-slot-empty")) {
      const index = [...element.parentElement!.children].indexOf(element);
      return rect((600 - columns * width) / 2 + index % columns * width,
        400 + Math.floor(index / columns) * width * 1.42, width, width * 1.42);
    }
    return rect(90, 150, 420, 250);
  });
});

afterEach(() => vi.restoreAllMocks());

function expectHandFits(container: HTMLElement) {
  const row = container.querySelector<HTMLElement>(".card-fan-row")!;
  const slot = row.querySelector<HTMLElement>(".hand-slot-empty")!.getBoundingClientRect();
  const cards = [...row.querySelectorAll<HTMLElement>(".hand-card-slot")];
  expect(slot.width).toBeLessThan(100);
  expect(cards).toHaveLength(6);
  for (const card of cards) {
    expect(parseFloat(card.style.width)).toBeCloseTo(slot.width);
    expect(card.style.visibility).toBe("visible");
  }
  expect(parseFloat(cards[0].style.left)).toBeCloseTo(slot.left);
}

test("fits visible cards to the final slots on the first commit, before resize delivery", () => {
  const { container } = render(table(player));
  expectHandFits(container);
});

test("synchronizes a newly mounted hand and a trump panel layout change immediately", () => {
  const { container, rerender } = render(table(undefined));
  rerender(table(player));
  expectHandFits(container);
  rerender(table(player, true));
  expectHandFits(container);
  rerender(table(player, false));
  expectHandFits(container);
});
