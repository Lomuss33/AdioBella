import { t } from "../i18n";
import type { VisualSettings } from "../lib/preferences";
import PlayingCard from "./PlayingCard";

export default function AppearanceSettings({ visual, onChange }: { visual: VisualSettings; onChange: (patch: Partial<VisualSettings>) => void }) {
  return <section className="appearance-settings">
    <label><span>{t("book.cardStyle")}</span><select value={visual.cardStyle} onChange={event => onChange({ cardStyle: event.target.value as VisualSettings['cardStyle'] })}>
      <option value="classic">{t("book.classic")}</option><option value="modern">{t("book.modern")}</option><option value="contrast">{t("book.contrast")}</option>
    </select></label>
    <label><span>{t("book.accent")}</span><select value={visual.accent} onChange={event => onChange({ accent: event.target.value as VisualSettings['accent'] })}>
      <option value="gold">{t("book.gold")}</option><option value="silver">{t("book.silver")}</option><option value="copper">{t("book.copper")}</option>
    </select></label>
    <div className="appearance-preview" role="group" aria-label={t("book.preview")}>
      <PlayingCard card={{ rank: 'ACE', suit: 'SPADES', label: 'as', faceUp: true, playable: false }} disabled />
      <PlayingCard card={{ rank: 'QUEEN', suit: 'HEARTS', label: 'qh', faceUp: true, playable: false }} disabled />
    </div>
  </section>;
}
