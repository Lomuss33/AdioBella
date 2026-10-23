import { useId, type CSSProperties } from "react";
import { countText, t, tr } from "../i18n";
import { getMeldCardColumns } from "../lib/meldReviewLayout";
import { useMeldReviewLayout } from "../lib/useMeldReviewLayout";
import { usePopupDialog } from "../lib/usePopupDialog";
import type { MeldDeclarationView } from "../types";
import MeldSetSection from "./MeldSetSection";
import { PopupDialog, PopupCard, PopupContent, PopupActions } from "./GamePopup";

export default function MeldDetails({ melds, yourTeam, onClose }: {
  melds: MeldDeclarationView[];
  yourTeam?: string;
  onClose: () => void;
}) {
  const dialogRef = usePopupDialog(true);
  const titleId = useId();
  const descriptionId = useId();
  const columns = Math.max(1, ...melds.flatMap(set =>
    (set.melds ?? []).map(meld => getMeldCardColumns(meld.cards.length))));
  useMeldReviewLayout(dialogRef, true, melds);

  return (
    <PopupDialog ref={dialogRef} layout="panel" className="belot-dialog-melds belot-dialog-meld-action belot-dialog-floating-actions"
      aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <PopupCard data-declaration-count={melds.length}
        style={{ "--meld-max-columns": columns } as CSSProperties}>
        <PopupContent className="meld-details-content" tabIndex={0} role="region" aria-label={t("Declared melds")}>
          <header className="action-popup-header meld-details-heading">
            <h2 id={titleId} className="action-popup-title">{t("Meld details")}</h2>
            <p id={descriptionId} className="meld-details-description">{t("Declarations and Bela points for this game.")}</p>
            <button type="button" className="meld-details-close" aria-label={t("Close meld details")} onClick={onClose}>×</button>
          </header>
          <div className="action-popup-body meld-popup-body">
            {melds.length === 0 ? (
              <div className="meld-details-empty">
                <strong>{t("No declarations yet")}</strong>
                <p>{t("Melds and Bela points will appear here as they are recorded.")}</p>
              </div>
            ) : <div className="meld-winner-players">
              {melds.map(meld => <MeldSetSection key={meld.playerId} showTeam yourTeam={yourTeam}
                meldSet={{ ...meld, totalPoints: meld.meldPoints + meld.belaPoints, melds: meld.melds ?? [] }}
                emptyContent={meld.labels.length > 0 ? <ul className="meld-details-labels">
                  {meld.labels.map((label, index) => <li key={index}>{tr(label)}</li>)}
                </ul> : <p className="meld-details-note">{t(meld.belaPoints > 0
                  ? "Bela declared; no other melds recorded." : "No meld combinations recorded.")}</p>}>
                {meld.belaPoints > 0 ? <div className="meld-combination-heading meld-details-bela">
                  <strong>{t("Bela")}</strong>
                  <span className="meld-combination-points">+{countText("points", meld.belaPoints)}</span>
                </div> : null}
              </MeldSetSection>)}
            </div>}
          </div>
        </PopupContent>
        <PopupActions>
          <button type="button" className="action-button action-button-primary" autoFocus onClick={onClose}>{t("Back to table")}</button>
        </PopupActions>
      </PopupCard>
    </PopupDialog>
  );
}
