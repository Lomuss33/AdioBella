import { accentPalettes, tablePalettes, TABLE_THEMES } from "../lib/appearanceTheme";
import type { CSSProperties } from "react";
import { t } from "../i18n";
import type { MessageKey } from "../i18n/catalog";
import { ACCENT_COLORS, CARD_STYLES, type VisualSettings } from "../lib/preferences";
import type { TableTheme } from "../types";
import PlayingCard from "./PlayingCard";

const cardStyleMessages: Record<VisualSettings["cardStyle"], MessageKey> = {
  original: "book.original",
  french: "book.french",
  italian: "book.italian",
  german: "book.german",
  modern: "book.modern",
  heritage: "book.heritage",
  "four-color": "book.fourColor"
};
const accentLabels: Record<VisualSettings["accent"], MessageKey> = {
  oxblood: "book.oxblood",
  "bottle-green": "book.bottleGreen",
  midnight: "book.midnight",
  "antique-brass": "book.antiqueBrass",
  ivory: "book.ivory",
  saddle: "book.saddle",
  aubergine: "book.aubergine",
  graphite: "book.graphite"
};
const tableLabels: Record<TableTheme, MessageKey> = {
  GREEN: "green", TEAL: "teal felt", DARK_BLUE: "dark blue", PLUM: "plum felt",
  CHERRY_RED: "cherry red", WOODY_BROWN: "dark brown", LIGHT_BROWN: "light brown", FINE_BLACK: "fine black"
};

const deckPreviewCards = [
  ["ACE", "SPADES"],
  ["KING", "HEARTS"],
  ["QUEEN", "DIAMONDS"],
  ["JACK", "CLUBS"],
  ["TEN", "SPADES"],
  ["SEVEN", "HEARTS"]
] as const;
const previewCards = deckPreviewCards.map(([rank, suit]) => ({
  rank,
  suit,
  label: `${rank}_${suit}`,
  faceUp: true,
  playable: false
}));

export function CardStylePicker({ value, onChange }: { value: VisualSettings["cardStyle"]; onChange: (value: VisualSettings["cardStyle"]) => void }) {
  const values = CARD_STYLES;
  const index = values.indexOf(value);
  return <div className="appearance-setting appearance-card-style" role="group" aria-label={t("book.cardStyle")}>
    <div className="card-style-preview-row">
      <output className="card-style-name" aria-live="polite">{t("book.cards")}: {t(cardStyleMessages[value])}</output>
      <div className="card-style-preview-gallery">
        <div className="appearance-preview" data-card-style={value} role="group" aria-label={t("book.preview")}>
          {previewCards.map(card => <PlayingCard key={card.label} card={card} disabled />)}
        </div>
        <button className="card-style-next" type="button" aria-label={t("book.nextCardStyle")} title={t("book.nextCardStyle")} onClick={() => onChange(values[(index + 1) % values.length])}>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  </div>;
}

export function AccentColorPicker({ value, onChange }: { value: VisualSettings["accent"]; onChange: (value: VisualSettings["accent"]) => void }) {
  return <div className="appearance-setting appearance-accent-setting"><span>{t("book.accent")}</span>
    <div className="accent-color-choices" role="group" aria-label={t("book.accent")}>
      {ACCENT_COLORS.map(accent => <button key={accent} type="button" className="accent-color-choice" style={{ "--accent-swatch": accentPalettes[accent].swatch } as CSSProperties} title={t(accentLabels[accent])} aria-label={t(accentLabels[accent])} aria-pressed={value === accent} onClick={() => onChange(accent)} />)}
    </div>
  </div>;
}

export function TableColorPicker({ value, onChange }: { value: TableTheme; onChange: (theme: TableTheme) => void }) {
  return <div className="appearance-setting appearance-table-colors"><span>{t("table color")}</span>
    <div className="setup-theme-buttons" role="group" aria-label={t("table color")}>
      {TABLE_THEMES.map(theme => <button key={theme} type="button" className={`setup-theme-choice setup-theme-${theme.toLowerCase()}`} style={{ "--swatch": tablePalettes[theme].swatch } as CSSProperties} title={t(tableLabels[theme])} aria-label={t(tableLabels[theme])} aria-pressed={value === theme} onClick={() => onChange(theme)} />)}
    </div>
  </div>;
}
