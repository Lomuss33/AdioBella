import { useEffect, useId, useRef, useState } from "react";
import { t, useLanguage, isPreference } from "../i18n";
import type { Locale } from "../i18n";

type Flag = Locale | "auto";

export default function LanguageSelect() {
  const { preference, locale, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const active = preference === "auto" ? locale : preference;
  const options: { value: Flag; label: string }[] = [
    { value: "auto", label: t("Automatic (browser)") },
    { value: "en", label: "English" },
    { value: "de", label: "Deutsch" },
    { value: "hr", label: "Hrvatski" }
  ];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div className="language-select language-flag-select" onKeyDown={event => {
    if (event.key === "Escape") setOpen(false);
  }} ref={ref}>
    <button type="button" className="language-flag-trigger" aria-label={`${t("Language")}: ${options.find(option => option.value === preference)?.label}`} title={t("Language")} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <FlagIcon language={active} /><span className="language-flag-chevron" aria-hidden="true">&#x2304;</span>
    </button>
    {open && <div id={id} className="language-flag-options" role="group" aria-label={t("Language")}>
      {options.map(option => <button key={option.value} type="button" lang={option.value === "auto" ? undefined : option.value} aria-pressed={preference === option.value} onClick={() => {
        if (isPreference(option.value)) setLanguage(option.value);
        setOpen(false);
      }}><span className="language-option-flag" aria-hidden="true">{option.value === "auto" ? <span className="language-auto-icon">◎</span> : <FlagIcon language={option.value} />}</span><span>{option.label}</span><span className={`language-option-check ${preference === option.value ? "is-selected" : ""}`} aria-hidden="true"></span></button>)}
    </div>}
  </div>;
}

function FlagIcon({ language }: { language: Locale }) {
  if (language === "de") return <svg className="language-flag-icon" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="5.34" fill="#171717"/><rect y="5.33" width="24" height="5.34" fill="#d33b3b"/><rect y="10.66" width="24" height="5.34" fill="#f5c842"/></svg>;
  if (language === "hr") return <svg className="language-flag-icon" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="5.34" fill="#e33d4c"/><rect y="5.33" width="24" height="5.34" fill="#fff"/><rect y="10.66" width="24" height="5.34" fill="#2672b9"/><path d="M9 4h6v1.1H9zm0 1.1h1.2v1H9zm2.4 0h1.2v1h-1.2zm2.4 0H15v1h-1.2zM10.2 6.1h1.2v1h-1.2zm2.4 0h1.2v1h-1.2z" fill="#d63849"/></svg>;
  return <svg className="language-flag-icon" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#24477d"/><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4"/><path d="M0 0 24 16M24 0 0 16" stroke="#c93643" strokeWidth="1.6"/><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="6"/><path d="M12 0v16M0 8h24" stroke="#c93643" strokeWidth="2.6"/></svg>;
}