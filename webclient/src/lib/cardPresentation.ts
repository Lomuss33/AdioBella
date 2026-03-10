import cardBack from "../assets/cards/back.svg";
import clubsSymbol from "../assets/suits/clubs.svg";
import diamondsSymbol from "../assets/suits/diamonds.svg";
import heartsSymbol from "../assets/suits/hearts.svg";
import spadesSymbol from "../assets/suits/spades.svg";
import type { CardView } from "../types";

export interface CardPresentation {
  className: string;
  label: string;
  assetSrc: string;
  assetAlt: string;
  suitName: string | null;
  hidden: boolean;
  pipSymbol: string;
  pipCount: number;
  usesPlaceholderArt: boolean;
  rankText: string;
  cornerText: string;
}

export interface SuitPresentation {
  choice: string;
  className: string;
  label: string;
  assetSrc: string;
  assetAlt: string;
}

const suitMap = {
  CLUBS: { className: "clubs", shortName: "c", label: "clubs", assetSrc: clubsSymbol, pipSymbol: "\u2663" },
  DIAMONDS: { className: "diams", shortName: "d", label: "diamonds", assetSrc: diamondsSymbol, pipSymbol: "\u2666" },
  HEARTS: { className: "hearts", shortName: "h", label: "hearts", assetSrc: heartsSymbol, pipSymbol: "\u2665" },
  SPADES: { className: "spades", shortName: "s", label: "spades", assetSrc: spadesSymbol, pipSymbol: "\u2660" }
} as const;

const rankMap = {
  ACE: { className: "rank-a", shortName: "a", display: "A", pipCount: 1, usesPlaceholderArt: false },
  KING: { className: "rank-k", shortName: "k", display: "K", pipCount: 1, usesPlaceholderArt: false },
  QUEEN: { className: "rank-q", shortName: "q", display: "Q", pipCount: 1, usesPlaceholderArt: false },
  JACK: { className: "rank-j", shortName: "j", display: "J", pipCount: 1, usesPlaceholderArt: false },
  TEN: { className: "rank-10", shortName: "10", display: "10", pipCount: 10, usesPlaceholderArt: false },
  NINE: { className: "rank-9", shortName: "9", display: "9", pipCount: 9, usesPlaceholderArt: false },
  EIGHT: { className: "rank-8", shortName: "8", display: "8", pipCount: 8, usesPlaceholderArt: false },
  SEVEN: { className: "rank-7", shortName: "7", display: "7", pipCount: 7, usesPlaceholderArt: false }
} as const;

export function toCardPresentation(card: CardView): CardPresentation {
  if (!card.faceUp || !card.suit || !card.rank) {
    return {
      className: "card back",
      label: "",
      assetSrc: cardBack,
      assetAlt: "Hidden card placeholder",
      suitName: null,
      hidden: true,
      pipSymbol: "",
      pipCount: 0,
      usesPlaceholderArt: true,
      rankText: "",
      cornerText: ""
    };
  }

  const suit = suitMap[card.suit as keyof typeof suitMap];
  const rank = rankMap[card.rank as keyof typeof rankMap];
  const label = `${rank.shortName}${suit.shortName}`;
  const cornerText = `${rank.display}${suit.pipSymbol}`;

  return {
    className: `card ${rank.className} ${suit.className}`,
    label,
    assetSrc: suit.assetSrc,
    assetAlt: `${card.rank.toLowerCase()} of ${suit.label}`,
    suitName: suit.label,
    hidden: false,
    pipSymbol: suit.pipSymbol,
    pipCount: rank.pipCount,
    usesPlaceholderArt: rank.usesPlaceholderArt,
    rankText: rank.display,
    cornerText
  };
}

export function toSuitPresentation(choice: string): SuitPresentation {
  const suit = suitMap[choice as keyof typeof suitMap];
  return {
    choice,
    className: suit.className,
    label: suit.label,
    assetSrc: suit.assetSrc,
    assetAlt: `${suit.label} placeholder symbol`
  };
}
