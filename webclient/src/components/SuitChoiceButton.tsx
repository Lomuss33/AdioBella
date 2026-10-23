import { tr } from "../i18n";
import { toSuitPresentation } from "../lib/cardPresentation";
import PlayingCard from "./PlayingCard";
import type { Suit, TrumpChoice } from "../types";

interface SuitChoiceButtonProps {
  choice: Suit;
  onChoose: (choice: TrumpChoice) => void;
  disabled?: boolean;
}

function SuitChoiceButton({ choice, onChoose, disabled = false }: SuitChoiceButtonProps) {
  const suit = toSuitPresentation(choice);
  const label = tr(suit.label);

  return (
    <button type="button" className="suit-choice-button" disabled={disabled} data-suit={choice} onClick={() => onChoose(choice)} aria-label={label}>
      <div className="suit-choice-visual" aria-hidden="true">
        <PlayingCard card={{ suit: choice, rank: "ACE", label: `ACE_${choice}`, faceUp: true, playable: false }} />
      </div>
      <span className="suit-choice-caption" aria-hidden="true">
        <span className="suit-choice-label suit-choice-label-top">{label}</span>
        <span className="suit-choice-label suit-choice-label-bottom">{label}</span>
      </span>
    </button>
  );
}

export default SuitChoiceButton;
