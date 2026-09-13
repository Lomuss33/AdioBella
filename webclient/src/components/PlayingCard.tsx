import { cardDescription } from "../i18n/presentation";
import type { CardView } from "../types";
import { toCardPresentation } from "../lib/cardPresentation";

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
    >
      <div className={`playing-card-face ${presentation.className}`}>
        {presentation.hidden ? (
          <div className="playing-card-back-mark" aria-hidden="true" />
        ) : (
          <>
            <span className="playing-card-corner playing-card-corner-top" aria-hidden="true">
              <span className="playing-card-rank">{presentation.rankText}</span>
              <span className="playing-card-corner-suit">{presentation.pipSymbol}</span>
            </span>
            <span className="playing-card-center" aria-hidden="true">
              {presentation.pipSymbol}
            </span>
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
