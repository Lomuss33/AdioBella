import { tr } from "../i18n";
import { toSuitPresentation } from "../lib/cardPresentation";

interface SuitChoiceButtonProps {
  choice: string;
  onChoose: (choice: string) => void;
}

function SuitChoiceButton({ choice, onChoose }: SuitChoiceButtonProps) {
  const suit = toSuitPresentation(choice);

  return (
    <button type="button" className="suit-choice-button" data-suit={choice} onClick={() => onChoose(choice)} aria-label={tr(suit.label)}>
      <div className={`suit-choice-visual ${suit.className}`}>
        <img src={suit.assetSrc} alt="" />
      </div>
      <span className="suit-choice-label">{tr(suit.label)}</span>
    </button>
  );
}

export default SuitChoiceButton;
