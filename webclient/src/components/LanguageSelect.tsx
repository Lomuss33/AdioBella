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
      }}><span className="language-option-flag" aria-hidden="true">{option.value === "auto" ? <span className="language-auto-icon">◉</span> : <FlagIcon language={option.value} />}</span><span>{option.label}</span><span className={`language-option-check ${preference === option.value ? "is-selected" : ""}`} aria-hidden="true"></span></button>)}
    </div>}
  </div>;
}

function FlagIcon({ language }: { language: Locale }) {
  if (language === "de") return <svg className="language-flag-icon" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="5.34" fill="#171717"/><rect y="5.33" width="24" height="5.34" fill="#d33b3b"/><rect y="10.66" width="24" height="5.34" fill="#f5c842"/></svg>;
  if (language === "hr") return <CroatianFlag />;
  return <svg className="language-flag-icon" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#24477d"/><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4"/><path d="M0 0 24 16M24 0 0 16" stroke="#c93643" strokeWidth="1.6"/><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="6"/><path d="M12 0v16M0 8h24" stroke="#c93643" strokeWidth="2.6"/></svg>;
}

function CroatianFlag() {
  const shieldClipId = `${useId().replaceAll(":", "")}-croatian-shield`;
  const checks = Array.from({ length: 25 }, (_, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    return <rect key={index} x={8.9 + column * 1.24} y={6.1 + row * 1.24} width="1.25" height="1.25" fill={(column + row) % 2 === 0 ? "#d51f35" : "#fff"} />;
  });

  return <svg className="language-flag-icon" viewBox="0 0 24 16" aria-hidden="true">
    <defs><clipPath id={shieldClipId}><path d="M8.55 5.55h6.9v4.35c0 2.05-1.48 3.55-3.45 4.8-1.97-1.25-3.45-2.75-3.45-4.8z" /></clipPath></defs>
    <rect width="24" height="5.34" fill="#ed2939" />
    <rect y="5.33" width="24" height="5.34" fill="#fff" />
    <rect y="10.66" width="24" height="5.34" fill="#171796" />
    <g fill="#1761a0" stroke="#fff" strokeWidth=".24">
      <path d="M4.8 3.3h2.5v1.45c0 .62-.48 1.02-1.25 1.5-.77-.48-1.25-.88-1.25-1.5z" />
      <path d="M7.65 3.3h2.5v1.45c0 .62-.48 1.02-1.25 1.5-.77-.48-1.25-.88-1.25-1.5z" />
      <path d="M10.5 3.3H13v1.45c0 .62-.48 1.02-1.25 1.5-.77-.48-1.25-.88-1.25-1.5z" />
      <path d="M13.35 3.3h2.5v1.45c0 .62-.48 1.02-1.25 1.5-.77-.48-1.25-.88-1.25-1.5z" />
      <path d="M16.2 3.3h2.5v1.45c0 .62-.48 1.02-1.25 1.5-.77-.48-1.25-.88-1.25-1.5z" />
    </g>
    <g fill="#f4c542">
      <path d="m5.45 4 .35-.45.35.45-.35.45z" />
      <path d="M8.05 4h1.7v.28h-1.7zm0 .58h1.7v.28h-1.7z" />
      <circle cx="11.2" cy="3.95" r=".22" /><circle cx="12.05" cy="3.95" r=".22" /><circle cx="11.62" cy="4.55" r=".22" />
      <path d="m14 4.7.55-.95.55.95z" />
      <path d="M16.7 3.85h1.5v.22h-1.5zm0 .48h1.5v.22h-1.5z" />
    </g>
    <path d="M8.55 5.55h6.9v4.35c0 2.05-1.48 3.55-3.45 4.8-1.97-1.25-3.45-2.75-3.45-4.8z" fill="#fff" stroke="#27313b" strokeWidth=".42" />
    <g clipPath={`url(#${shieldClipId})`}>{checks}</g>
    <path d="M8.55 5.55h6.9v4.35c0 2.05-1.48 3.55-3.45 4.8-1.97-1.25-3.45-2.75-3.45-4.8z" fill="none" stroke="#27313b" strokeWidth=".42" />
  </svg>;
}
