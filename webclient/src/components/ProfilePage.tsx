import { useState } from "react";
import { t, useLanguage } from "../i18n";
import { loadPlayerProfile, PROFILE_MARKS, savePlayerProfile, type ProfileMark } from "../lib/playerProfile";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import LanguageSelect from "./LanguageSelect";
import "../styles/profile.css";

export default function ProfilePage({ onBack }: { onBack: () => void }) {
  useLanguage();
  useSavedAppearance();
  const [profile, setProfile] = useState(loadPlayerProfile);
  const [saved, setSaved] = useState(false);
  const save = () => setSaved(savePlayerProfile(profile));
  return <main className="profile-page">
    <header className="profile-topbar">
      <button type="button" onClick={onBack}>← {t("home.back")}</button><LanguageSelect />
    </header>
    <section className="profile-content">
      <p className="home-kicker">BELOT · PLAYER</p>
      <h1>{t("home.profile")}</h1>
      <p className="profile-lede">{t("home.profileIntro")}</p>
      <div className="profile-card">
        <div className="profile-preview" aria-hidden="true">{profile.mark}</div>
        <label className="rooms-field">{t("home.profileName")}
          <input autoComplete="nickname" maxLength={24} value={profile.name}
            onChange={event => { setProfile(current => ({ ...current, name: event.target.value })); setSaved(false); }} />
        </label>
        <fieldset className="profile-marks"><legend>{t("home.profileMark")}</legend>
          {PROFILE_MARKS.map(mark => <button key={mark} type="button" aria-pressed={profile.mark === mark}
            aria-label={mark} className={profile.mark === mark ? "profile-mark-selected" : ""}
            onClick={() => { setProfile(current => ({ ...current, mark: mark as ProfileMark })); setSaved(false); }}>{mark}</button>)}
        </fieldset>
        <button className="profile-save" type="button" onClick={save}>{t(saved ? "home.profileSaved" : "home.profileSave")}</button>
      </div>
      <p className="profile-local-note">{t("home.profileLocal")}</p>
    </section>
    <footer className="home-footer"><span>{t("home.noAccount")}</span><span>BELOT<span className="home-brand-dot">.</span></span></footer>
  </main>;
}
