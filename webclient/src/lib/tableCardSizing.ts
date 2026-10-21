import { HAND_CAPACITY } from "./handLayout";

export type TrickLayout = "cross" | "spread";

export interface CardLayoutMode {
  handRows: 1 | 2;
  trickLayout: TrickLayout;
}

interface CardSpace {
  handCount: number;
  handWidth: number;
  trickWidth: number;
  maxCardWidth: number;
  aspectRatio: number;
  handGap: number;
  handRowGap: number;
  trickGap: number;
  minimumTrickHeight?: number;
  previous?: CardLayoutMode;
}

type TableCardSpace = CardSpace & (
  | { flow: "stacked"; height: number }
  | { flow: "beside"; handHeight: number; trickHeight: number }
);

export interface TableCardLayout extends CardLayoutMode {
  handColumns: number;
  cardWidth: number;
}

const CARD_STEP = .25;
const TRICK_GEOMETRY = {
  cross: { columns: 3, verticalSpan: 2, verticalGaps: 1 },
  spread: { columns: 4, verticalSpan: 1.35, verticalGaps: 0 }
} as const;
// Retain the current arrangement within one CSS pixel of optimal at a boundary.
// This absorbs subpixel noise without a percentage-based size jump.
export const MODE_TOLERANCE = 1;
const floorCardSize = (size: number) => Math.max(0, Math.floor((size + 1e-7) / CARD_STEP) * CARD_STEP);

/** The smallest non-overlapping footprint of four cards in each arrangement. */
export function trickFootprint(layout: TrickLayout, cardWidth: number, aspectRatio: number, gap: number) {
  const geometry = TRICK_GEOMETRY[layout];
  return {
    width: geometry.columns * cardWidth + (geometry.columns - 1) * gap,
    height: geometry.verticalSpan * cardWidth * aspectRatio + geometry.verticalGaps * gap
  };
}

/**
 * Compare every one/two-row hand and cross/spread combination together. Both
 * sets share the largest feasible width; ties favor fewer rows, then the cross.
 * Inputs exclude padding, metadata and the points lane, so the result cannot
 * feed its own previous card sizes back into the available-space calculation.
 */
export function fitTableCards(space: TableCardSpace): TableCardLayout {
  const count = Math.max(1, Math.min(HAND_CAPACITY, Math.floor(space.handCount)));
  const ratio = Math.max(.1, space.aspectRatio);
  const candidates: TableCardLayout[] = [];
  for (const handRows of count > 1 ? [1, 2] as const : [1] as const) {
    const handColumns = Math.ceil(count / handRows);
    const handWidthLimit = (space.handWidth - (handColumns - 1) * space.handGap) / handColumns;
    const handFixedHeight = (handRows - 1) * space.handRowGap;
    for (const trickLayout of ["cross", "spread"] as const) {
      const geometry = TRICK_GEOMETRY[trickLayout];
      const trickWidthLimit = (space.trickWidth - (geometry.columns - 1) * space.trickGap) / geometry.columns;
      const trickFixedHeight = geometry.verticalGaps * space.trickGap;
      const heightLimit = space.flow === "stacked"
        ? Math.min((space.height - handFixedHeight - trickFixedHeight) / (ratio * (handRows + geometry.verticalSpan)),
          (space.height - handFixedHeight - (space.minimumTrickHeight ?? 0)) / (ratio * handRows))
        : Math.min((space.handHeight - handFixedHeight) / (ratio * handRows),
          (space.trickHeight - trickFixedHeight) / (ratio * geometry.verticalSpan));
      candidates.push({ handRows, handColumns, trickLayout,
        cardWidth: floorCardSize(Math.min(space.maxCardWidth, handWidthLimit, trickWidthLimit, heightLimit)) });
    }
  }
  candidates.sort((a, b) => b.cardWidth - a.cardWidth || a.handRows - b.handRows
    || Number(a.trickLayout === "spread") - Number(b.trickLayout === "spread"));
  const best = candidates[0];
  const previous = candidates.find(candidate => candidate.handRows === space.previous?.handRows
    && candidate.trickLayout === space.previous.trickLayout);
  return previous && previous.cardWidth > 0 && best.cardWidth - previous.cardWidth <= MODE_TOLERANCE
    ? previous : best;
}

/** Offsets use the same footprint as the solver, including the clear gaps. */
export function placeTrickCards(layout: TrickLayout, cardWidth: number, aspectRatio: number, gap: number, height: number) {
  const cardHeight = cardWidth * aspectRatio;
  const spread = layout === "spread";
  return {
    offsetX: spread ? (cardWidth + gap) * 1.5 : cardWidth + gap,
    offsetY: spread ? Math.max(0, Math.min((height - cardHeight) / 2, cardHeight * .62 + gap / 2))
      : (cardHeight + gap) / 2,
    northX: spread ? -(cardWidth + gap) / 2 : 0,
    southX: spread ? (cardWidth + gap) / 2 : 0
  };
}
