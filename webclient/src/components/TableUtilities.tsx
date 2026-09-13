import { useEffect, useId, useRef, useState } from "react";
import { t, useLanguage, type LanguagePreference } from "../i18n";

export function InfoButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="table-square-button" onClick={onClick} aria-label={t("book.open")} title={t("book.open")} aria-haspopup="dialog">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v7m0-11v2" /></svg>
  </button>;
}
export default function TableUtilities({ onOpenBook }: { onOpenBook: () => void }) {
  const { preference, setLanguage, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="table-utilities">
    <InfoButton onClick={onOpenBook} />
    <div className="language-dropup" ref={ref} onKeyDown={event => {
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={trigger} type="button" className="table-square-button language-trigger" aria-label={t("Language")} title={t("Language")} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg><small aria-hidden="true">{locale.toUpperCase()}</small>
      </button>
      {open && <div id={id} className="language-dropup-options" role="group" aria-label={t("Language")}>
        {([['auto', t("Automatic (browser)")], ['en', 'English'], ['de', 'Deutsch'], ['hr', 'Hrvatski']] as [LanguagePreference, string][]).map(([value, label]) =>
          <button type="button" key={value} lang={value === "auto" ? locale : value} aria-pressed={preference === value} onClick={() => { setLanguage(value); setOpen(false); trigger.current?.focus(); }}>
            <span>{label}</span><span aria-hidden="true">{preference === value ? '✓' : ''}</span>
          </button>)}
      </div>}
    </div>
  </div>;
}
