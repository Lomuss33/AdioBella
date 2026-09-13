import { meldDescription } from "../i18n/presentation";
import { t, tr, countText } from "../i18n";
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
        <span className="match-summary-title">{t("gameNumber", { count: score?.gameNumber || "—" })}</span>
        <span>{tr((score?.difficulty ?? "NORMAL").toLowerCase())}</span>
        <span>{t("firstTo", { count: score?.matchTargetWins ?? 3 })}</span>
        <span>{countText("points", score?.gameTargetPoints ?? 1001)}</span>
        <button type="button" className="match-details-label" aria-haspopup="dialog" onClick={() => setShowMelds(true)}>{t("Meld details")}</button>
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
            <h2 id={titleId} className="action-popup-title">{t("Meld details")}</h2>
            <p id={descriptionId} className="action-popup-subtitle">{t("Declarations and Bela points for this game.")}</p>
          </div>
          <button type="button" className="meld-details-close" aria-label={t("Close meld details")} onClick={onClose}>×</button>
        </header>
        <div className="popup-content meld-details-content" tabIndex={0} role="region" aria-label={t("Declared melds")}>
          {melds.length === 0 ? (
            <div className="meld-details-empty">
              <span aria-hidden="true">♧</span>
              <strong>{t("No declarations yet")}</strong>
              <p>{t("Melds and Bela points will appear here as they are recorded.")}</p>
            </div>
          ) : melds.map((meld) => (
            <article className="meld-details-player" key={meld.playerId}>
              <header className="meld-details-player-heading">
                <div><strong>{meld.playerName}</strong><small>{meld.teamName}</small></div>
                <span className="meld-details-total"><strong>{meld.meldPoints + meld.belaPoints}</strong><small>{t("points")}</small></span>
              </header>
              <dl className="meld-details-breakdown">
                <div><dt>{t("Melds")}</dt><dd>{meld.meldPoints}</dd></div>
                <div><dt>{t("Bela")}</dt><dd>{meld.belaPoints}</dd></div>
              </dl>
              {meld.labels.length > 0 ? (
                <ul className="meld-details-labels">{meld.labels.map((label, index) => <li key={`${index}-${label}`}>{meld.melds?.[index] ? meldDescription(meld.melds[index]) : tr(label)}</li>)}</ul>
              ) : <p className="meld-details-note">{meld.belaPoints > 0 ? t("Bela declared; no other melds recorded.") : t("No meld combinations recorded.")}</p>}
            </article>
          ))}
        </div>
        <div className="popup-footer action-controls">
          <button type="button" className="action-button action-button-primary" autoFocus onClick={onClose}>{t("Back to table")}</button>
        </div>
      </div>
    </dialog>
  );
}
