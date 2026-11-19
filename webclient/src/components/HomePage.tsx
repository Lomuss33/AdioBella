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
      <nav className="home-top-nav" aria-label={t("home.navigation")}>
        <button className="home-top-nav-active" type="button" onClick={onHome}>{t("home.lobby")}</button>
        <button type="button" onClick={() => setShowGuide(true)}>{t("home.rules")}</button>
      </nav>
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
      <aside className="home-side-nav" aria-label={t("home.navigation")}>
        <span className="home-side-caption">{t("home.menu")}</span>
        <button className="home-side-link is-active" type="button" onClick={onHome}><span>⌂</span>{t("home.lobby")}</button>
        <button className="home-side-link" type="button" onClick={onPlaySolo}><span>♠</span>{t("home.solo")}</button>
        {!singlePlayerOnly && <button className="home-side-link" type="button" onClick={onOpenRooms}><span>♧</span>{t("home.multiplayer")}</button>}
        <button className="home-side-link" type="button" onClick={() => setShowGuide(true)}><span>▤</span>{t("home.rules")}</button>
        {!singlePlayerOnly && rooms.length > 0 && <div className="home-side-saved">
          <span className="home-side-caption">{t("home.savedTablesMenu")}</span>
          {rooms.slice(0, 3).map(room => <button key={room.roomId} type="button" onClick={() => onOpenRoom(room.roomId)}>
            <span className="home-room-dot" />{room.name || room.roomId.slice(0, 8)}
          </button>)}
        </div>}
        <div className="home-side-bottom"><span className="home-online-dot" />{t("home.tableReady")}</div>
      </aside>

      <section className="home-lobby" aria-labelledby="home-title">
        <div className="home-lobby-heading">
          <div><p className="home-kicker">{t("home.kicker")}</p><h1 id="home-title">{t("home.headline")}</h1></div>
          <span className="home-lobby-tag"><span aria-hidden="true">♠</span> {t("home.lobby")}</span>
        </div>

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
            <span className="home-art-badge home-art-badge-top">{t("home.soloTable")}</span>
            <span className="home-art-badge home-art-badge-bottom"><span className="home-online-dot" /> {t("home.freePlay")}</span>
          </div>
          <div className="home-feature-copy">
            <div className="home-feature-eyebrow"><span className="home-online-dot" /> {t("home.readyToDeal")}</div>
            <h2>{t(hasSoloSave ? "home.resumeSoloTitle" : "home.soloTitle")}</h2>
            <p>{t("home.soloLede")}</p>
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
            <span className="home-tile-icon">▤</span><span><b>{t("home.rulesTitle")}</b><small>{t("home.learnRules")}</small></span><span className="home-tile-arrow">↗</span>
          </button>
          {!singlePlayerOnly && <button className="home-lobby-tile home-lobby-tile-friends" type="button" onClick={onOpenRooms}>
            <span className="home-tile-icon">♧</span><span><b>{t("home.friendsTitle")}</b><small>{t("home.friendsDescription")}</small></span><span className="home-tile-arrow">↗</span>
          </button>}
        </div>
      </section>

      <aside className="home-info-rail">
        <section className="home-profile-card">
          <span className="home-side-caption">{t("home.yourSeat")}</span>
          <div className="home-profile-avatar">{playerProfile.mark}</div>
          <strong>{playerProfile.name || t("home.guest")}</strong>
          <span className="home-profile-status"><span className="home-online-dot" />{t("home.tableReady")}</span>
          {!singlePlayerOnly && <button type="button" onClick={onOpenProfile}>{t("home.profile")} <span>↗</span></button>}
        </section>
        <section className="home-lobby-note">
          <span className="home-note-icon">✦</span><div><b>{t("home.noAccount")}</b><p>{t(browserRuntime ? "home.localSaveNote" : "home.serverSessionNote")}</p></div>
        </section>
        <div className="home-info-footer">BELOT CLUB <span>·</span> {t("home.freePlay")}</div>
      </aside>
    </div>

    {showGuide && <GuideBook initialChapter="welcome" onClose={() => setShowGuide(false)} />}
  </main>;
}
