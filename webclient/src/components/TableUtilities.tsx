import { t } from "../i18n";
import LanguageSelect from "./LanguageSelect";

export function InfoButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="table-square-button" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onClick(); }} aria-label={t("book.open")} title={t("book.open")} aria-haspopup="dialog">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v7m0-11v2" /></svg>
  </button>;
}
export default function TableUtilities({ onOpenBook }: { onOpenBook: () => void }) {
  return <div className="table-utilities">
    <InfoButton onClick={onOpenBook} />
    <LanguageSelect variant="table" />
  </div>;
}
