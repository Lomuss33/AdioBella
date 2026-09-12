import { useState } from "react";
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
  return (
    <dialog ref={dialogRef} className="belot-dialog" aria-label="Meld details"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="popup-card">
        <div className="popup-content">
          <div className="action-popup-header action-popup-header-start">
            <h2 className="action-popup-title">Meld details</h2>
            <p className="action-popup-subtitle">Declared points for this game.</p>
          </div>
          <div className="meld-popup-stack">
            {melds.length === 0 ? <p>No melds declared this game.</p> : melds.map((meld) => (
              <div className="meld-detail-row" key={`${meld.playerId}-${meld.labels.join("-")}-${meld.belaPoints}`}>
                <span>{meld.playerName} · {meld.teamName}</span>
                <strong>{meld.meldPoints + meld.belaPoints} points</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="popup-footer action-controls">
          <button type="button" className="action-button action-button-primary" autoFocus onClick={onClose}>Back to table</button>
        </div>
      </div>
    </dialog>
  );
}