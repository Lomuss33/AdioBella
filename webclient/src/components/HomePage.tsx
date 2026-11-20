import { useState } from "react";
import { t, useLanguage } from "../i18n";
import GuideBook from "./GuideBook";
import SettingsButton from "./SettingsButton";
import { readStorage } from "../lib/preferences";
import { LEGACY_SOLO_SAVE_KEY, listSoloGames } from "../lib/soloGames";
import { loadPlayerProfile } from "../lib/playerProfile";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import "../styles/home.css";

const playerSeats = ["north", "east", "south", "west"] as const;

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
  const hasSoloSave = listSoloGames().length > 0 || Boolean(readStorage(LEGACY_SOLO_SAVE_KEY));

  return <main className="home-page home-page-lobby">
    <div className="home-table-scene" aria-hidden="true">
      {playerSeats.map(seat => <div key={seat} className={`home-table-player home-table-player-${seat}`} />)}
    </div>
    <header className="home-topbar">
      <button className="home-brand" type="button" onClick={onHome} aria-label="Belot home">
        <span className="home-brand-mark" aria-hidden="true">B</span>
        <span>BELOT<span className="home-brand-dot">.</span></span>
      </button>
      <div className="home-top-actions">
        {!singlePlayerOnly && <button type="button" className="home-player-pill" onClick={onOpenProfile}>
          <span className="home-player-avatar" aria-hidden="true">{playerProfile.mark}</span>
          <span>{playerProfile.name || t("home.guest")}</span><span className="home-pill-chevron" aria-hidden="true">⌄</span>
        </button>}
        <SettingsButton />
      </div>
    </header>

    <section className="home-lobby" aria-labelledby="home-title">
      <div className="home-mode-menu">
        <h1 id="home-title">Belot</h1>
        <div className="home-mode-actions">
          <div className="home-table-background" aria-hidden="true" />
          <button className="home-mode home-mode-solo" type="button" onClick={onPlaySolo}>
            <span className="home-mode-icon" aria-hidden="true">♠</span>
            <strong>Singleplayer</strong>
            <span className="home-mode-description">{t("home.soloWithBots")}</span>
            <span className="home-mode-action">
              {t(hasSoloSave ? "solo.title" : "home.startPlaying")}
              <span aria-hidden="true">→</span>
            </span>
          </button>
          <button className="home-mode home-mode-online" type="button" disabled={singlePlayerOnly} onClick={onOpenRooms}>
            <span className="home-mode-icon" aria-hidden="true">♣</span>
            <strong>Multiplayer</strong>
            <span className="home-mode-description">{t("home.playFriends")}</span>
            <span className="home-mode-action">
              {t(singlePlayerOnly ? "home.multiplayerUnavailable" : "home.createOrJoin")}
              <span aria-hidden="true">{singlePlayerOnly ? "–" : "→"}</span>
            </span>
          </button>
        </div>
        <button className="home-rules-link" type="button" onClick={() => setShowGuide(true)}>{t("home.rules")}</button>
      </div>
    </section>

    {showGuide && <GuideBook initialChapter="welcome" onClose={() => setShowGuide(false)} />}
  </main>;
}
