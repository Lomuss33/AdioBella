import { meldDescription } from "../i18n/presentation";
import { t, tr, number, countText } from "../i18n";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import type { GameSnapshot, MeldDeclarationView } from "../types";
import { usePopupDialog } from "../lib/usePopupDialog";

export default function MatchDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const [showMelds, setShowMelds] = useState(false);
  const score = snapshot?.score;
  const gameTitle = t(score?.difficulty === "HARD" ? "gameHeading.hard" : score?.difficulty === "EASY" ? "gameHeading.easy" : "gameHeading.normal", { count: score?.gameNumber || "—" });
  const wins = score?.matchTargetWins ?? 3;
  const points = score?.gameTargetPoints ?? 1001;
  const summaryKey = wins === 1 ? "matchSummary.one" : wins < 5 ? "matchSummary.few" : "matchSummary.other";
  const summary = t(summaryKey, { wins, points });
  return (
    <>
      <button
        type="button"
        className="match-data-card"
        aria-haspopup="dialog"
        aria-expanded={showMelds}
        aria-label={`${t("Meld details")}: ${gameTitle}, ${summary}`}
        title={t("Meld details")}
        onClick={() => setShowMelds(true)}
      >
        <span className="match-summary">
          <span className="match-summary-heading">
            <strong className="match-summary-title">{gameTitle}</strong>
          </span>
          <span className="match-summary-targets" title={summary}>
            <small className="match-summary-target-caption">{t("First to")}</small>
            <span className="match-summary-goals">
              <span className="match-summary-goal">
                <strong>{number(wins)}</strong>
                <small>{countText("wins", wins).slice(number(wins).length).trim()}</small>
              </span>
              <span className="match-summary-goal">
                <small>{t("with")}</small>
                <strong>{number(points)}</strong>
                <small>{t("matchSummary.pointsUnit")}</small>
              </span>
            </span>
          </span>
        </span>
        <svg className="match-summary-open" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {showMelds && createPortal(
        <MeldDetails melds={score?.meldDeclarations ?? []}
          yourTeam={snapshot?.players.find(player => player.seat === "SOUTH")?.team}
          onClose={() => setShowMelds(false)} />,
        document.body
      )}
    </>
  );
}

function MeldDetails({ melds, yourTeam, onClose }: { melds: MeldDeclarationView[]; yourTeam?: string; onClose: () => void }) {
  const dialogRef = usePopupDialog(true);
  const titleId = useId();
  const descriptionId = useId();
  return (
    <dialog ref={dialogRef} className="belot-dialog belot-dialog-melds" aria-labelledby={titleId}
      aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="popup-card" data-declaration-count={melds.length}>
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
            <article className="meld-details-player" data-team={meld.teamName === yourTeam ? "your" : "opponent"} key={meld.playerId}>
              <header className="meld-details-player-heading">
                <div className="meld-details-identity">
                  <span className="meld-details-field-label">{t("player")}:</span><h3>{meld.playerName}</h3>
                  <span className="meld-details-field-label">{t("team")}:</span><small>{meld.teamName}</small>
                </div>
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
