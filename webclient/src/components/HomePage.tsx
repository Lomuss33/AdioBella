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

  return <main className={`home-page home-page-lobby${singlePlayerOnly ? " home-page-singleplayer" : ""}`}>
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

    <div className="home-lobby-shell">
      <section className="home-lobby" aria-labelledby="home-title">

        <section className="home-feature" aria-label={t("home.soloTitle")}>
          <div className="home-feature-art" aria-hidden="true">
            <div className="home-table-glow" />
            <div className="home-feature-table"><div className="home-feature-table-ring" />
              <div className="home-table-seat home-table-seat-north"><span>♣</span><i /></div>
              <div className="home-table-seat home-table-seat-west"><span>♠</span><i /></div>
              <div className="home-table-seat home-table-seat-east"><span>♥</span><i /></div>
              <div className="home-table-cards"><span className="home-preview-card card-back-one" /><span className="home-preview-card card-back-two" />
                <span className="home-preview-card card-front-one"><b>A</b><i>♠</i></span><span className="home-preview-card card-front-two"><b>K</b><i>♥</i></span></div>
              <div className="home-table-center-mark">♠ <span>BELOT</span> ♦</div>
              <div className="home-table-you"><span className="home-player-avatar">{playerProfile.mark}</span><span>{playerProfile.name || t("home.you")}</span><i /></div>
            </div>
          </div>
          <div className="home-feature-copy">
            <div className="home-feature-eyebrow"><span className="home-online-dot" /> {t(hasSoloSave ? "home.backToTheTable" : "home.readyToDeal")}</div>
            <h1 id="home-title">{t(hasSoloSave ? "home.resumeSoloTitle" : "home.soloTitle")}</h1>
            <p>{t("home.soloDescription")}</p>
            <div className="home-feature-meta"><span><b>3</b> {t("home.botOpponents")}</span><span className="home-meta-divider" /><span>{t("home.matchLength")}</span></div>
            <button className="home-play-button" type="button" onClick={onPlaySolo}>
              <span className="home-play-icon" aria-hidden="true">▶</span>
              <span>{t(hasSoloSave ? "home.continueSolo" : "home.playSolo")}</span>
              <span className="home-play-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
        </section>

        <div className="home-action-row" aria-label={t("home.chooseYourGame")}>
          <button className="home-lobby-tile home-lobby-tile-rules" type="button" onClick={() => setShowGuide(true)}>
            <span className="home-tile-icon" aria-hidden="true">▤</span><span><b>{t("home.rulesTitle")}</b><small>{t("home.learnRules")}</small></span><span className="home-tile-arrow" aria-hidden="true">↗</span>
          </button>
          {!singlePlayerOnly && <button className="home-lobby-tile home-lobby-tile-friends" type="button" onClick={onOpenRooms}>
            <span className="home-tile-icon" aria-hidden="true">♧</span><span><b>{t("home.friendsTitle")}</b><small>{t("home.createOrJoin")}</small></span><span className="home-tile-arrow" aria-hidden="true">↗</span>
          </button>}
          {singlePlayerOnly && <div className="home-lobby-note">
            <span className="home-note-icon" aria-hidden="true">✓</span><div><b>{t("home.noAccount")}</b><p>{t(browserRuntime ? "home.localSaveNote" : "home.serverSessionNote")}</p></div>
          </div>}
        </div>
      </section>
    </div>

    {showGuide && <GuideBook initialChapter="welcome" onClose={() => setShowGuide(false)} />}
  </main>;
}
