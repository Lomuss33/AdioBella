import { tr } from "../i18n";
import { toSuitPresentation } from "../lib/cardPresentation";
import PlayingCard from "./PlayingCard";
import type { Suit, TrumpChoice } from "../types";

interface SuitChoiceButtonProps {
  choice: Suit;
  onChoose: (choice: TrumpChoice) => void;
}

function SuitChoiceButton({ choice, onChoose }: SuitChoiceButtonProps) {
  const suit = toSuitPresentation(choice);

  return (
    <button type="button" className="suit-choice-button" data-suit={choice} onClick={() => onChoose(choice)} aria-label={tr(suit.label)}>
      <div className="suit-choice-visual" aria-hidden="true">
        <PlayingCard card={{ suit: choice, rank: "ACE", label: `ACE_${choice}`, faceUp: true, playable: false }} />
      </div>
      <span className="suit-choice-caption">
        <span className="suit-choice-label">{tr(suit.label)}</span>
        <svg className="suit-choice-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

export default SuitChoiceButton;
