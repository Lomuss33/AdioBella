import { useState } from "react";
import { t, useLanguage } from "../i18n";
import GuideBook from "./GuideBook";
import LanguageSelect from "./LanguageSelect";
import { savedRoomAccess } from "../lib/roomGateway";
import { getGameRuntime } from "../lib/gameGateway";
import { readStorage } from "../lib/preferences";
import { loadPlayerProfile } from "../lib/playerProfile";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import "../styles/home.css";

type HomePageProps = {
  singlePlayerOnly?: boolean;
  onPlaySolo: () => void;
  onOpenRooms: () => void;
  onOpenRoom: (roomId: string) => void;
  onOpenProfile: () => void;
  onHome: () => void;
};

export default function HomePage({ singlePlayerOnly = false, onPlaySolo, onOpenRooms, onOpenRoom, onOpenProfile, onHome }: HomePageProps) {
  useLanguage();
  const [showGuide, setShowGuide] = useState(false);
  useSavedAppearance();
  const playerProfile = loadPlayerProfile();
  const rooms = savedRoomAccess();
  const sessionKey = getGameRuntime() === "browser" ? "belot-browser-session-id" : "belot-session-id";
  const hasSoloSave = Boolean(readStorage(sessionKey));

  return <main className={`home-page${singlePlayerOnly ? " home-page-singleplayer" : ""}`}>
    <header className="home-topbar">
      <button className="home-brand" type="button" onClick={onHome} aria-label="Belot home">
        <span className="home-brand-mark" aria-hidden="true">B</span>
        <span>BELOT<span className="home-brand-dot">.</span></span>
      </button>
      <LanguageSelect />
    </header>

    <section className="home-lobby" aria-labelledby="home-title">
      <div className="home-intro">
        <div className="home-welcome-mark" aria-hidden="true"><span>♠</span><span>♥</span><span>♣</span><span>♦</span></div>
        <p className="home-kicker">{t("home.kicker")}</p>
        <h1 id="home-title">{t("home.headline")}</h1>
        <p className="home-lede">{t("home.lobbyLede")}</p>
      </div>

      <div className="home-main-area">
        <div className="home-main-actions" aria-label={t("home.chooseYourGame")}>
          <button className="home-action-card home-action-solo" type="button" onClick={onPlaySolo}>
            <span className="home-action-top"><span className="home-action-suit" aria-hidden="true">♠</span><span aria-hidden="true">↗</span></span>
            <span className="home-action-eyebrow">{t("home.modeSolo")}</span>
            <strong>{t(hasSoloSave ? "home.continueSolo" : "home.playSolo")}</strong>
          </button>
          {!singlePlayerOnly && <button className="home-action-card home-action-friends" type="button" onClick={onOpenRooms}>
            <span className="home-action-top"><span className="home-action-suit" aria-hidden="true">♧</span><span aria-hidden="true">↗</span></span>
            <span className="home-action-eyebrow">{t("home.modeMultiplayer")}</span>
            <strong>{t("home.playFriends")}</strong>
          </button>}
        </div>

        <div className="home-extra-actions">
          <button className="home-rules-link" type="button" onClick={() => setShowGuide(true)}>{t("home.rules")} <span aria-hidden="true">↗</span></button>
          {!singlePlayerOnly && <button className="home-rules-link" type="button" onClick={onOpenProfile}><span aria-hidden="true">{playerProfile.mark}</span> {playerProfile.name || t("home.profile")} <span aria-hidden="true">↗</span></button>}
          {!singlePlayerOnly && rooms.length > 0 && <details className="home-tables-menu">
            <summary>{t("home.savedTablesMenu")} <span className="home-table-count">{rooms.length}</span></summary>
            <div className="home-tables-popover">
              {rooms.slice(0, 6).map(room => <button key={room.roomId} type="button" onClick={() => onOpenRoom(room.roomId)}>
                <span>{room.name || room.roomId.slice(0, 8)}</span><small>{room.roomId.slice(0, 8)}</small><span aria-hidden="true">↗</span>
              </button>)}
            </div>
          </details>}
        </div>
      </div>
    </section>

    <footer className="home-footer"><span>{t("home.noAccount")}</span><span>BELOT<span className="home-brand-dot">.</span></span></footer>
    {showGuide && <GuideBook initialChapter="welcome" onClose={() => setShowGuide(false)} />}
  </main>;
}
