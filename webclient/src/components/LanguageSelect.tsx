import { t, useLanguage, isPreference } from "../i18n";
export default function LanguageSelect() {
  const { preference, setLanguage } = useLanguage();
  return <label className="language-select"><span>{t("Language")}</span>
    <select value={preference} onChange={event => { if (isPreference(event.target.value)) setLanguage(event.target.value); }}>
      <option value="auto">{t("Automatic (browser)")}</option>
      <option value="en" lang="en">English</option><option value="de" lang="de">Deutsch</option><option value="hr" lang="hr">Hrvatski</option>
    </select>
  </label>;
}
