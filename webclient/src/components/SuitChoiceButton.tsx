import { toSuitPresentation } from "../lib/cardPresentation";

interface SuitChoiceButtonProps {
  choice: string;
  onChoose: (choice: string) => void;
}

function SuitChoiceButton({ choice, onChoose }: SuitChoiceButtonProps) {
  const suit = toSuitPresentation(choice);

  return (
    <button type="button" className="suit-choice-button" onClick={() => onChoose(choice)} aria-label={suit.label}>
      <div className={`suit-choice-visual ${suit.className}`}>
        <img src={suit.assetSrc} alt={suit.assetAlt} />
      </div>
      <span className="suit-choice-label">{suit.label}</span>
    </button>
  );
}

export default SuitChoiceButton;
