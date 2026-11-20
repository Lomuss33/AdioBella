import { createContext, useContext, useId, useState } from "react";
import { createPortal } from "react-dom";
import { t, useLanguage } from "../i18n";
import { loadPreferences, updateDisplayPreferences, displayPreferences, type DisplayPreferences } from "../lib/preferences";
import { usePopupDialog } from "../lib/usePopupDialog";
import SetupOptions from "./SetupOptions";
import type { MatchRules } from "../types";
import { CardStyleProvider } from "./CardStyleContext";
import { PopupCard, PopupContent, PopupDialog } from "./GamePopup";
import { LanguageField } from "./LanguageSelect";
import "../styles/settings.css";

type DisplayControls = {
  value: DisplayPreferences;
  onChange: (patch: Partial<DisplayPreferences>) => void;
};

const DisplaySettingsContext = createContext<DisplayControls | null>(null);
export const DisplaySettingsProvider = DisplaySettingsContext.Provider;

export function DisplaySettingsFields({ value, onChange, rules }: DisplayControls & { rules?: { value: MatchRules; onChange: (patch: Partial<MatchRules>) => void } }) {
  return <div className="display-settings-fields">
    <CardStyleProvider value={value.cardStyle}>
      <SetupOptions display={{ value, onChange }} rules={rules} />
    </CardStyleProvider>
    <div className="settings-playback" role="group" aria-label={t("playback.controls")}>
      <label>{t("playback.skipAnimations")} <input type="checkbox" checked={value.skipAnimations} onChange={event => onChange({ skipAnimations: event.target.checked })} /></label>
      <label>{t("playback.fastSpeed")} <input type="checkbox" checked={value.speed === "fast"} onChange={event => onChange({ speed: event.target.checked ? "fast" : "normal" })} /></label>
    </div>
  </div>;
}

export default function SettingsButton({ table = false }: { table?: boolean }) {
  useLanguage();
  const controls = useContext(DisplaySettingsContext);
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(() => displayPreferences(loadPreferences()));
  return <>
    <button type="button" className={table ? "table-square-button" : "toolbar-text-button"} aria-haspopup="dialog"
      onClick={event => { event.currentTarget.focus({ preventScroll: true }); setLocal(displayPreferences(loadPreferences())); setOpen(true); }}
      aria-label={t("Settings")} title={t("Settings")}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
        <path d="M9.5 3h5l.7 2.5 2 .9 2.4-.8 2.5 4.3-1.8 1.8v.6l1.8 1.8-2.5 4.3-2.4-.8-2 .9-.7 2.5h-5l-.7-2.5-2-.9-2.4.8-2.5-4.3 1.8-1.8v-.6L1.9 9.9l2.5-4.3 2.4.8 2-.9z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {!table && t("Settings")}
    </button>
    {open && createPortal(<SettingsDialog value={controls?.value ?? local} onChange={controls?.onChange ?? (patch => {
      setLocal(current => ({ ...current, ...patch }));
      updateDisplayPreferences(patch);
    })} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

function SettingsDialog({ value, onChange, onClose }: DisplayControls & { onClose: () => void }) {
  const id = useId();
  const ref = usePopupDialog(true);
  return <PopupDialog ref={ref} layout="page" className="settings-dialog" aria-labelledby={id}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <PopupCard>
      <header className="guide-heading">
        <h2 id={id} tabIndex={-1} data-popup-initial-focus>{t("Settings")}</h2>
        <button type="button" className="table-square-button" aria-label={t("book.close")} onClick={onClose}>×</button>
      </header>
      <PopupContent>
        <LanguageField />
        <DisplaySettingsFields value={value} onChange={onChange} />
      </PopupContent>
    </PopupCard>
  </PopupDialog>;
}
