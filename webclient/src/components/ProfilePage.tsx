import { useState } from "react";
import { t, useLanguage } from "../i18n";
import { loadPlayerProfile, PROFILE_MARKS, savePlayerProfile, type ProfileMark } from "../lib/playerProfile";
import { useSavedAppearance } from "../lib/useSavedAppearance";
import SettingsButton from "./SettingsButton";
import "../styles/profile.css";

const markLabels = { "♠": "spades", "♥": "hearts", "♣": "clubs", "♦": "diamonds" } as const satisfies Record<ProfileMark, string>;

export default function ProfilePage({ onBack }: { onBack: () => void }) {
  useLanguage();
  useSavedAppearance();
  const [saved, setSaved] = useState(loadPlayerProfile);
  const [draft, setDraft] = useState(saved);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const name = draft.name.trim();
  const dirty = name !== saved.name || draft.mark !== saved.mark;

  function save() {
    if (!dirty) return;
    const profile = { ...draft, name };
    if (!savePlayerProfile(profile)) {
      setFeedback("error");
      return;
    }
    setSaved(profile);
    setDraft(profile);
    setFeedback("saved");
  }

  return <main className="profile-page">
    <header className="profile-topbar">
      <button type="button" className="toolbar-text-button" onClick={onBack}>← {t("home.back")}</button>
      <SettingsButton />
    </header>
    <section className="profile-content" aria-labelledby="profile-title">
      <h1 id="profile-title">{t("home.profile")}</h1>
      <div className="profile-layout">
        <section className="profile-preview" aria-label={t("home.profilePreview")}>
          <span className="profile-emblem" aria-hidden="true">{draft.mark}</span>
          <strong>{name || t("home.guest")}</strong>
        </section>
        <form className="profile-card" onSubmit={event => { event.preventDefault(); save(); }}>
          <label className="profile-field">{t("home.profileName")}
            <input autoComplete="nickname" maxLength={24} value={draft.name} placeholder={t("home.guest")}
              onChange={event => { setDraft({ ...draft, name: event.target.value }); setFeedback(null); }} />
          </label>
          <fieldset className="profile-marks">
            <legend>{t("home.profileMark")}</legend>
            <div className="profile-mark-options">
              {PROFILE_MARKS.map(mark => <label key={mark} title={t(markLabels[mark])}>
                <input type="radio" name="profile-mark" value={mark} checked={draft.mark === mark}
                  aria-label={t(markLabels[mark])} onChange={() => { setDraft({ ...draft, mark }); setFeedback(null); }} />
                <span aria-hidden="true">{mark}</span>
              </label>)}
            </div>
          </fieldset>
          <div className="profile-actions">
            {dirty && <button type="button" onClick={() => { setDraft(saved); setFeedback(null); }}>{t("home.profileReset")}</button>}
            <button className="profile-save" type="submit" disabled={!dirty}>{t("home.profileSave")}</button>
          </div>
          {feedback === "saved" && <p className="profile-feedback" role="status">{t("home.profileSaved")}</p>}
          {feedback === "error" && <p className="profile-feedback" role="alert">{t("home.profileSaveError")}</p>}
          <p className="profile-local-note">{t("home.profileLocal")}</p>
        </form>
      </div>
    </section>
  </main>;
}
