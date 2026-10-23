import { t } from "../i18n";
import { errorDescription } from "../i18n/presentation";
import { usePopupDialog } from "../lib/usePopupDialog";
import { PopupActions, PopupCard, PopupContent, PopupDialog } from "./GamePopup";

/** Startup failures keep the saved session intact and offer an explicit retry. */
export default function SessionStatus({ pending, error, onRetry }: {
  pending: boolean; error: string | null; onRetry: () => void;
}) {
  const ref = usePopupDialog(true);
  return <PopupDialog ref={ref} layout="panel" aria-label={t("Loading table")}
    onCancel={event => event.preventDefault()}>
    <PopupCard>
      <PopupContent aria-busy={pending}>
        <h2 className="action-popup-title">{t("Loading table")}</h2>
        {error ? <p className="error-line" role="alert">{errorDescription(error)}</p> : null}
      </PopupContent>
      {error ? <PopupActions><button type="button" className="action-button action-button-primary"
        disabled={pending} onClick={onRetry}>{t("session.retry")}</button></PopupActions> : null}
    </PopupCard>
  </PopupDialog>;
}
