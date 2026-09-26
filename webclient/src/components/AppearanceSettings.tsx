import { t } from "../i18n";
import { tr } from "../i18n";
import type { VisualSettings } from "../lib/preferences";
import type { TableTheme } from "../types";
import PlayingCard from "./PlayingCard";

export default function AppearanceSettings({ visual, onChange, tableTheme, onTableThemeChange }: { visual: VisualSettings; onChange: (patch: Partial<VisualSettings>) => void; tableTheme?: TableTheme; onTableThemeChange?: (theme: TableTheme) => void }) {
  return <section className="appearance-settings">
    <div className="appearance-setting"><span>{t("book.cardStyle")}</span><VisualStepper ariaLabel={t("book.cardStyle")} values={["classic", "modern", "contrast"]} value={visual.cardStyle} label={key => t(`book.${key}` as "book.classic" | "book.modern" | "book.contrast")} onChange={cardStyle => onChange({ cardStyle })} /></div>
    <div className="appearance-setting"><span>{t("book.accent")}</span><VisualStepper className="choice-stepper-accent" ariaLabel={t("book.accent")} values={["gold", "silver", "copper"]} value={visual.accent} label={key => t(`book.${key}` as "book.gold" | "book.silver" | "book.copper")} onChange={accent => onChange({ accent })} /></div>
    {tableTheme && onTableThemeChange ? <div className="appearance-setting appearance-table-colors"><span>{t("table color")}</span>
      <div className="setup-theme-buttons" role="group" aria-label={t("table color")}>
        {([
          { value: "GREEN", label: "green" }, { value: "DARK_BLUE", label: "dark blue" }, { value: "CHERRY_RED", label: "cherry red" }, { value: "WOODY_BROWN", label: "woody brown" }, { value: "FINE_BLACK", label: "fine black" }
        ] as const).map(theme => <button key={theme.value} type="button" className={`setup-theme-choice setup-theme-${theme.value.toLowerCase()}`} title={tr(theme.label)} aria-label={tr(theme.label)} aria-pressed={tableTheme === theme.value} onClick={() => onTableThemeChange(theme.value)} />)}
      </div>
    </div> : null}
    <div className="appearance-preview" role="group" aria-label={t("book.preview")}>
      <PlayingCard card={{ rank: "ACE", suit: "SPADES", label: "as", faceUp: true, playable: false }} disabled />
      <PlayingCard card={{ rank: "QUEEN", suit: "HEARTS", label: "qh", faceUp: true, playable: false }} disabled />
      <PlayingCard card={{ rank: "KING", suit: "DIAMONDS", label: "kd", faceUp: true, playable: false }} disabled />
    </div>
  </section>;
}

function VisualStepper<T extends VisualSettings["cardStyle"] | VisualSettings["accent"]>({ ariaLabel, values, value, label, onChange, className }: {
  ariaLabel: string;
  values: readonly T[];
  value: T;
  label: (value: T) => string;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = values.indexOf(value);
  return <div className={`choice-stepper ${className ?? ""}`} data-value={value} role="group" aria-label={ariaLabel}>
    <button type="button" aria-label={`${ariaLabel} previous`} onClick={() => onChange(values[(index - 1 + values.length) % values.length])}><span aria-hidden="true">&#x2039;</span></button>
    <output aria-live="polite">{label(value)}</output>
    <button type="button" aria-label={`${ariaLabel} next`} onClick={() => onChange(values[(index + 1) % values.length])}><span aria-hidden="true">&#x203A;</span></button>
  </div>;
}
