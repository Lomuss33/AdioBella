interface SharedCardBudget {
  height: number;
  trickWidthLimit: number;
  handWidthLimit: number;
  handRows: number;
  aspectRatio: number;
  trickSpan: number;
}

const floorQuarter = (size: number) => Math.max(1, Math.floor(size * 4) / 4);

/** Share height fairly, then give any unused width budget back to the other set. */
export function fitSharedCards({ height, trickWidthLimit, handWidthLimit, handRows, aspectRatio, trickSpan }: SharedCardBudget) {
  const available = Math.max(0, height) / aspectRatio;
  const balanced = available / (trickSpan + handRows * .95);
  let trick = Math.min(trickWidthLimit, balanced);
  let hand = Math.min(handWidthLimit, trick * .95);
  trick = Math.min(trickWidthLimit, (available - handRows * hand) / trickSpan);
  hand = Math.min(handWidthLimit, (available - trickSpan * trick) / handRows);
  return { trick: floorQuarter(trick), hand: floorQuarter(hand) };
}

interface TrickCardSpace {
  width: number;
  height: number;
  maxCardWidth: number;
  aspectRatio: number;
  allowSpread: boolean;
  gap?: number;
}

/** Use four staggered columns when a short field would make the cross too small. */
export function fitTrickCards({ width, height, maxCardWidth, aspectRatio, allowSpread, gap = 4 }: TrickCardSpace) {
  const availableWidth = Math.max(0, width - 4);
  const availableHeight = Math.max(0, height - 4);
  const crossWidth = floorQuarter(Math.min(maxCardWidth, availableWidth / 3.8,
    (availableHeight - gap) / (aspectRatio * 2.24)));
  // Keep a visible north/south stagger, even on very short landscape screens.
  const spreadWidth = floorQuarter(Math.min(maxCardWidth, (availableWidth - gap * 3) / 4,
    availableHeight / (aspectRatio * 1.35)));
  const spread = allowSpread && spreadWidth > crossWidth * 1.12;
  const cardWidth = spread ? spreadWidth : crossWidth;
  const cardHeight = cardWidth * aspectRatio;
  return {
    cardWidth,
    offsetX: spread ? (cardWidth + gap) * 1.5 : cardWidth * 1.4,
    offsetY: spread ? Math.max(0, Math.min((availableHeight - cardHeight) / 2, cardHeight * .62 + gap / 2))
      : cardHeight * .62 + gap / 2,
    northX: spread ? -(cardWidth + gap) / 2 : 0,
    southX: spread ? (cardWidth + gap) / 2 : 0
  };
}
