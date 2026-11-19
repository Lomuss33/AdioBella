import { useState } from "react";
import { t, useLanguage } from "../i18n";
import GuideBook from "./GuideBook";
import LanguageSelect from "./LanguageSelect";
import { getGameRuntime } from "../lib/gameGateway";
import { readStorage } from "../lib/preferences";
import { loadPlayerProfile } from "../lib/playerProfile";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import "../styles/home.css";

type HomePageProps = {
  singlePlayerOnly?: boolean;
  onPlaySolo: () => void;
  onOpenRooms: () => void;
  onOpenProfile: () => void;
  onHome: () => void;
};

export default function HomePage({ singlePlayerOnly = false, onPlaySolo, onOpenRooms, onOpenProfile, onHome }: HomePageProps) {
  useLanguage();
  const [showGuide, setShowGuide] = useState(false);
  useSavedAppearance();
  const playerProfile = loadPlayerProfile();
  const browserRuntime = getGameRuntime() === "browser";
  const sessionKey = browserRuntime ? "belot-browser-session-id" : "belot-session-id";
  const hasSoloSave = Boolean(readStorage(sessionKey));

  return <main className="home-page home-page-lobby">
    <header className="home-topbar">
      <button className="home-brand" type="button" onClick={onHome} aria-label="Belot home">
        <span className="home-brand-mark" aria-hidden="true">B</span>
        <span>BELOT<span className="home-brand-dot">.</span></span>
        <span className="home-brand-caption">CARD CLUB</span>
      </button>
      <div className="home-top-actions">
        <span className="home-free-badge"><span aria-hidden="true">✦</span> {t("home.freePlay")}</span>
        {!singlePlayerOnly && <button type="button" className="home-player-pill" onClick={onOpenProfile}>
          <span className="home-player-avatar">{playerProfile.mark}</span>
          <span>{playerProfile.name || t("home.guest")}</span><span className="home-pill-chevron" aria-hidden="true">⌄</span>
        </button>}
        <LanguageSelect />
      </div>
    </header>

    <section className="home-lobby" aria-labelledby="home-title">
      <div className="home-table-background" aria-hidden="true" />
      <div className="home-mode-menu">
        <h1 id="home-title">Belot</h1>
        <div className="home-mode-actions">
          <button className="home-mode home-mode-solo" type="button" onClick={onPlaySolo}>
            <span className="home-mode-icon" aria-hidden="true">♠</span>
            <span><strong>Singleplayer</strong><small>{t(hasSoloSave ? "home.continueSolo" : "home.playSolo")}</small></span>
            <span aria-hidden="true">›</span>
          </button>
          <button className="home-mode home-mode-online" type="button" disabled={singlePlayerOnly} onClick={onOpenRooms}>
            <span className="home-mode-icon" aria-hidden="true">♣</span>
            <span><strong>Multiplayer</strong><small>{t(singlePlayerOnly ? "home.multiplayerUnavailable" : "home.createOrJoin")}</small></span>
            {!singlePlayerOnly && <span aria-hidden="true">›</span>}
          </button>
        </div>
        <button className="home-rules-link" type="button" onClick={() => setShowGuide(true)}>{t("home.rules")}</button>
      </div>
    </section>

    {showGuide && <GuideBook initialChapter="welcome" onClose={() => setShowGuide(false)} />}
  </main>;
}
