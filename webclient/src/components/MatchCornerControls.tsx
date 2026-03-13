interface MatchCornerControlsProps {
  canForfeitGame: boolean;
  canQuitMatch: boolean;
  onForfeitGame: () => void;
  onQuitMatch: () => void;
}

function MatchCornerControls({
  canForfeitGame,
  canQuitMatch,
  onForfeitGame,
  onQuitMatch
}: MatchCornerControlsProps) {
  return (
    <aside className="match-corner-controls" aria-label="Match controls">
      <button type="button" className="action-button match-corner-button match-corner-button-warning" onClick={onForfeitGame} disabled={!canForfeitGame}>
        Forfeit game
      </button>
      <button type="button" className="action-button match-corner-button match-corner-button-danger" onClick={onQuitMatch} disabled={!canQuitMatch}>
        Quit match
      </button>
    </aside>
  );
}

export default MatchCornerControls;
