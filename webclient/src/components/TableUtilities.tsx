import { t } from "../i18n";
import SettingsButton from "./SettingsButton";

export function InfoButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="table-square-button" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onClick(); }} aria-label={t("book.open")} title={t("book.open")} aria-haspopup="dialog">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v7m0-11v2" /></svg>
  </button>;
}

export function HomeButton({ onClick, labeled = false, soloLobby = false }: { onClick: () => void; labeled?: boolean; soloLobby?: boolean }) {
  const label = t(soloLobby ? "solo.title" : "home.back");
  return <button type="button" className={labeled ? "toolbar-text-button" : "table-square-button"} aria-label={label} title={label} onClick={onClick}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 11 9-8 9 8M5.5 9v11h5v-5h3v5h5V9" />
    </svg>
    {labeled && label}
  </button>;
}

export function TableNavigation({ onHome, onOpenRooms, refresh, homeIsSoloLobby }: {
  onHome?: () => void;
  homeIsSoloLobby?: boolean;
  onOpenRooms?: () => void;
  refresh?: { onClick: () => void; disabled: boolean };
}) {
  const roomsLabel = t(refresh ? "rooms.list" : "rooms.title");
  return <nav className="table-navigation-controls" aria-label={t("home.navigation")}>
    {onOpenRooms && <button type="button" className="table-square-button" aria-label={roomsLabel} title={roomsLabel} onClick={onOpenRooms}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="7" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v2" />
      </svg>
    </button>}
    {refresh && <button type="button" className="table-square-button" aria-label={t("rooms.refresh")} title={t("rooms.refresh")} onClick={refresh.onClick} disabled={refresh.disabled}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 4v5h-5m5 0a8 8 0 1 0 0 6" />
      </svg>
    </button>}
    {onHome && <HomeButton soloLobby={homeIsSoloLobby} onClick={onHome} />}
  </nav>;
}
export default function TableUtilities({ onOpenBook }: { onOpenBook: () => void }) {
  return <div className="table-utilities">
    <InfoButton onClick={onOpenBook} />
    <SettingsButton table />
  </div>;
}
