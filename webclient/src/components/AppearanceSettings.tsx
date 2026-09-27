import type { CSSProperties } from "react";
import { t, tr } from "../i18n";
import type { VisualSettings } from "../lib/preferences";
import type { TableTheme } from "../types";
import PlayingCard from "./PlayingCard";

export function CardStylePicker({ value, onChange }: { value: VisualSettings["cardStyle"]; onChange: (value: VisualSettings["cardStyle"]) => void }) {
  const values = ["classic", "modern", "contrast"] as const;
  const index = values.indexOf(value);
  return <div className="appearance-setting appearance-card-style" role="group" aria-label={t("book.cardStyle")}>
    <output className="card-style-name" aria-live="polite">{t(`book.${value}` as "book.classic" | "book.modern" | "book.contrast")}</output>
    <div className="card-style-preview-row">
      <div className="appearance-preview" role="group" aria-label={t("book.preview")}>
        <PlayingCard card={{ rank: "ACE", suit: "SPADES", label: "as", faceUp: true, playable: false }} disabled />
        <PlayingCard card={{ rank: "QUEEN", suit: "HEARTS", label: "qh", faceUp: true, playable: false }} disabled />
        <PlayingCard card={{ rank: "KING", suit: "DIAMONDS", label: "kd", faceUp: true, playable: false }} disabled />
      </div>
      <button className="card-style-next" type="button" aria-label={t("book.nextCardStyle")} title={t("book.nextCardStyle")} onClick={() => onChange(values[(index + 1) % values.length])}>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  </div>;
}

export function AccentColorPicker({ value, onChange }: { value: VisualSettings["accent"]; onChange: (value: VisualSettings["accent"]) => void }) {
  return <div className="appearance-setting appearance-accent-setting"><span>{t("book.accent")}</span>
    <div className="accent-color-choices" role="group" aria-label={t("book.accent")}>
      {([
        { value: "gold", label: "book.gold", color: "#b99a60" },
        { value: "silver", label: "book.silver", color: "#a9b6bc" },
        { value: "copper", label: "book.copper", color: "#bc9279" }
      ] as const).map(accent => <button key={accent.value} type="button" className="accent-color-choice" style={{ "--accent-swatch": accent.color } as CSSProperties} title={t(accent.label)} aria-label={t(accent.label)} aria-pressed={value === accent.value} onClick={() => onChange(accent.value)} />)}
    </div>
  </div>;
}

export function TableColorPicker({ value, onChange }: { value: TableTheme; onChange: (theme: TableTheme) => void }) {
  return <div className="appearance-setting appearance-table-colors"><span>{t("table color")}</span>
    <div className="setup-theme-buttons" role="group" aria-label={t("table color")}>
      {([
        { value: "GREEN", label: "green" }, { value: "DARK_BLUE", label: "dark blue" }, { value: "CHERRY_RED", label: "cherry red" }, { value: "WOODY_BROWN", label: "woody brown" }, { value: "FINE_BLACK", label: "fine black" }
      ] as const).map(theme => <button key={theme.value} type="button" className={`setup-theme-choice setup-theme-${theme.value.toLowerCase()}`} title={tr(theme.label)} aria-label={tr(theme.label)} aria-pressed={value === theme.value} onClick={() => onChange(theme.value)} />)}
    </div>
  </div>;
}
