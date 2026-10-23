import { t } from "../i18n";
import { usePopupDialog } from "../lib/usePopupDialog";
import { PopupDialog, PopupCard, PopupContent, PopupActions } from "./GamePopup";

export default function ConfirmPopup({ kind, onCancel, onConfirm }: {
  kind: "game" | "match";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = usePopupDialog(true);
  const title = kind === "game" ? t("Forfeit this game?") : t("Leave this match?");
  return (
    <PopupDialog ref={dialogRef} layout="panel" className="belot-dialog-confirm belot-dialog-floating-actions" aria-label={title} onCancel={(event) => {
      event.preventDefault();
      onCancel();
    }}>
      <PopupCard>
        <PopupContent>
          <div className="action-popup-header action-popup-header-start">
            <div className="popup-eyebrow"><span aria-hidden="true">♠</span> BELOT <span aria-hidden="true">♦</span></div>
            <h2 className="action-popup-title">{title}</h2>
            <p className="action-popup-subtitle">
              {kind === "game" ? t("Your opponents will win this game. You can continue with the next game if the match is not over.") : t("Your opponents will win the match. This cannot be undone.")}
            </p>
          </div>
        </PopupContent>
        <PopupActions>
          <button type="button" className="action-button action-button-primary action-button-safe" autoFocus onClick={onCancel}>{t("Keep playing")}</button>
          <button type="button" className="action-button action-button-danger" onClick={onConfirm}>{kind === "game" ? t("Forfeit game") : t("Quit match")}</button>
        </PopupActions>
      </PopupCard>
    </PopupDialog>
  );
}
