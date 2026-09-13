import { useId, useState } from "react";
import { createPortal } from "react-dom";
import type { GameSnapshot, MeldDeclarationView } from "../types";
import { usePopupDialog } from "../lib/usePopupDialog";

export default function MatchDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const [showMelds, setShowMelds] = useState(false);
  const score = snapshot?.score;
  return (
    <section className="match-data-card">
      <div className="match-summary">
        <span className="match-summary-title">Game {score?.gameNumber || "—"}</span>
        <span>{(score?.difficulty ?? "NORMAL").toLowerCase()}</span>
        <span>first to {score?.matchTargetWins ?? 3}</span>
        <span>{score?.gameTargetPoints ?? 1001} points</span>
        <button type="button" className="match-details-label" aria-haspopup="dialog" onClick={() => setShowMelds(true)}>Meld details</button>
      </div>
      {showMelds && createPortal(
        <MeldDetails melds={score?.meldDeclarations ?? []} onClose={() => setShowMelds(false)} />,
        document.body
      )}
    </section>
  );
}

function MeldDetails({ melds, onClose }: { melds: MeldDeclarationView[]; onClose: () => void }) {
  const dialogRef = usePopupDialog(true);
  const titleId = useId();
  const descriptionId = useId();
  return (
    <dialog ref={dialogRef} className="belot-dialog belot-dialog-melds" aria-labelledby={titleId}
      aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="popup-card">
        <header className="meld-details-heading">
          <div>
            <h2 id={titleId} className="action-popup-title">Meld details</h2>
            <p id={descriptionId} className="action-popup-subtitle">Declarations and Bela points for this game.</p>
          </div>
          <button type="button" className="meld-details-close" aria-label="Close meld details" onClick={onClose}>?</button>
        </header>
        <div className="popup-content meld-details-content" tabIndex={0} role="region" aria-label="Declared melds">
          {melds.length === 0 ? (
            <div className="meld-details-empty">
              <span aria-hidden="true">?</span>
              <strong>No declarations yet</strong>
              <p>Melds and Bela points will appear here as they are recorded.</p>
            </div>
          ) : melds.map((meld) => (
            <article className="meld-details-player" key={meld.playerId}>
              <header className="meld-details-player-heading">
                <div><strong>{meld.playerName}</strong><small>{meld.teamName}</small></div>
                <span className="meld-details-total"><strong>{meld.meldPoints + meld.belaPoints}</strong><small>points</small></span>
              </header>
              <dl className="meld-details-breakdown">
                <div><dt>Melds</dt><dd>{meld.meldPoints}</dd></div>
                <div><dt>Bela</dt><dd>{meld.belaPoints}</dd></div>
              </dl>
              {meld.labels.length > 0 ? (
                <ul className="meld-details-labels">{meld.labels.map((label, index) => <li key={`${index}-${label}`}>{label}</li>)}</ul>
              ) : <p className="meld-details-note">{meld.belaPoints > 0 ? "Bela declared; no other melds recorded." : "No meld combinations recorded."}</p>}
            </article>
          ))}
        </div>
        <div className="popup-footer action-controls">
          <button type="button" className="action-button action-button-primary" autoFocus onClick={onClose}>Back to table</button>
        </div>
      </div>
    </dialog>
  );
}
