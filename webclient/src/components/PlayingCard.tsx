import { cardDescription } from "../i18n/presentation";
import type { CardView } from "../types";
import { toCardPresentation } from "../lib/cardPresentation";
import { deckCardAsset } from "../lib/deckAssets";
import { SuitMark, type CardSuit } from "./SuitMark";
import { useCardStyle } from "./CardStyleContext";

interface PlayingCardProps {
  card: CardView;
  onClick?: () => void;
  disabled?: boolean;
  ownerName?: string;
  selected?: boolean;
  highlighted?: boolean;
  legalChoice?: boolean;
  blockedChoice?: boolean;
  className?: string;
}

function PlayingCard({
  card,
  onClick,
  disabled,
  ownerName,
  selected,
  highlighted,
  legalChoice,
  blockedChoice,
  className
}: PlayingCardProps) {
  const presentation = toCardPresentation(card);
  const deck = useCardStyle();
  const importedArtwork = deckCardAsset(deck, card);

  return (
    <button
      type="button"
      className={[
        "playing-card-shell",
        card.playable && !presentation.hidden ? "playable" : "",
        selected ? "selected" : "",
        highlighted ? "winning-card" : "",
        legalChoice ? "legal-choice" : "",
        blockedChoice ? "blocked-choice" : "",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${ownerName ? `${ownerName}: ` : ""}${cardDescription(card)}`}
      data-card-style={deck}
    >
      <div className={`playing-card-face ${presentation.className}${importedArtwork ? " has-imported-art" : ""}`} data-card-style={deck}>
        {importedArtwork ? (
          <>
            <img className="playing-card-imported-art" src={importedArtwork} alt="" draggable={false} aria-hidden="true" />
            {card.faceUp && card.rank && card.suit && (deck === "italian" || deck === "german") && (
              <span className="playing-card-center-index" aria-hidden="true">
                <span>{presentation.rankText}</span>
                <SuitMark suit={card.suit as CardSuit} />
              </span>
            )}
          </>
        ) : presentation.hidden ? (
          <div className="playing-card-back-mark" aria-hidden="true" />
        ) : (
          <>
            <span className="playing-card-corner playing-card-corner-top" aria-hidden="true">
              <span className="playing-card-rank">{presentation.rankText}</span>
              <span className="playing-card-corner-suit">{presentation.pipSymbol}</span>
            </span>
            <span className="playing-card-center" aria-hidden="true">{presentation.pipSymbol}</span>
            <span className="playing-card-corner playing-card-corner-bottom" aria-hidden="true">
              <span className="playing-card-rank">{presentation.rankText}</span>
              <span className="playing-card-corner-suit">{presentation.pipSymbol}</span>
            </span>
          </>
        )}
      </div>
    </button>
  );
}

export default PlayingCard;
