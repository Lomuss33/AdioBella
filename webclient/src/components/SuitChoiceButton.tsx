import { tr } from "../i18n";
import { toSuitPresentation } from "../lib/cardPresentation";
import { deckCardAsset } from "../lib/deckAssets";
import { useCardStyle } from "./CardStyleContext";
import { SuitMark } from "./SuitMark";

interface SuitChoiceButtonProps {
  choice: string;
  onChoose: (choice: string) => void;
}

function SuitChoiceButton({ choice, onChoose }: SuitChoiceButtonProps) {
  const suit = toSuitPresentation(choice);
  const deck = useCardStyle();
  const suitCard = deckCardAsset(deck, { rank: "SEVEN", suit: choice, faceUp: true });

  return (
    <button type="button" className="suit-choice-button" data-suit={choice} onClick={() => onChoose(choice)} aria-label={tr(suit.label)}>
      <div className={`suit-choice-visual ${suit.className}`} data-card-style={deck}>
        {suitCard ? <img src={suitCard} alt="" aria-hidden="true" /> : <SuitMark suit={choice as "CLUBS" | "DIAMONDS" | "HEARTS" | "SPADES"} />}
      </div>
      <span className="suit-choice-label">{tr(suit.label)}</span>
    </button>
  );
}

export default SuitChoiceButton;
