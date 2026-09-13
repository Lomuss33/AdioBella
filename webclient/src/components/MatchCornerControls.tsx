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
      <button
        type="button"
        className="action-button match-corner-button match-corner-button-warning"
        onClick={onForfeitGame}
        disabled={!canForfeitGame}
        title="End the current game and concede"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
        </svg>
        <span>Forfeit game</span>
      </button>
      <button
        type="button"
        className="action-button match-corner-button match-corner-button-danger"
        onClick={onQuitMatch}
        disabled={!canQuitMatch}
        title="Leave the current match"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 4H4v16h6m3-12 4 4-4 4m-5-4h13" />
        </svg>
        <span>Quit match</span>
      </button>
    </aside>
  );
}

export default MatchCornerControls;
