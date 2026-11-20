import type { ReactNode } from "react";
import { t, tr } from "../i18n";
import type { DisplayPreferences } from "../lib/preferences";
import type { MatchRules } from "../types";
import { AccentColorPicker, CardStylePicker, TableColorPicker } from "./AppearanceSettings";

type Controls<T> = { value: T; onChange: (patch: Partial<T>) => void };
type Appearance = Pick<DisplayPreferences, "cardStyle" | "accent" | "tableTheme">;

export default function SetupOptions({ rules, display }: { rules?: Controls<MatchRules>; display?: Controls<Appearance> }) {
  return <div className="setup-options-grid">
    {rules && <div className="setup-options-row">
      <SettingGroup label="game length" boxed>
        <CompactChoices numeric ariaLabel={t("game length")} values={["SHORT", "LONG"] as const} value={rules.value.gameLength} label={value => value === "SHORT" ? "501" : "1001"} describe={value => tr(value === "SHORT" ? "short 501" : "long 1001")} onChange={value => rules.onChange({ gameLength: value })} />
      </SettingGroup>
      <SettingGroup label="match length" boxed>
        <div className="match-length-choices" role="group" aria-label={t("match length")}>
          {([1, 3, 5] as const).map(value => <button key={value} type="button" data-choice={value} aria-label={t("firstTo", { count: value })} aria-pressed={rules.value.matchTargetWins === value} onClick={() => rules.onChange({ matchTargetWins: value })}>{value}</button>)}
        </div>
      </SettingGroup>
    </div>}
    <div className="setup-options-row">
      {rules && <SettingGroup label="mode">
        <CompactChoices ariaLabel={t("mode")} values={["EASY", "NORMAL", "HARD"] as const} value={rules.value.difficulty} label={value => tr(value.toLowerCase())} onChange={value => rules.onChange({ difficulty: value })} />
      </SettingGroup>}
      {display && <CardStylePicker value={display.value.cardStyle} onChange={cardStyle => display.onChange({ cardStyle })} />}
    </div>
    {display ? <div className="setup-options-row setup-colors-row">
      <AccentColorPicker value={display.value.accent} onChange={accent => display.onChange({ accent })} />
      <TableColorPicker value={display.value.tableTheme} onChange={tableTheme => display.onChange({ tableTheme })} />
    </div> : null}
  </div>;
}

function SettingGroup({
  label,
  children,
  boxed = false,
  className = ""
}: {
  label: string;
  children: ReactNode;
  boxed?: boolean;
  className?: string;
}) {
  return (
    <section data-setting={label} className={`setting-group ${boxed ? "setting-group-boxed" : ""} ${className}`.trim()}>
      <span className="panel-caption">{tr(label)}</span>
      <div className="setting-pill-row">{children}</div>
    </section>
  );
}

function CompactChoices<T extends string>({ ariaLabel, values, value, label, describe, onChange, numeric = false }: {
  ariaLabel: string;
  numeric?: boolean;
  values: readonly T[];
  value: T;
  label: (value: T) => string;
  describe?: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return <div className={`setup-segment-control${numeric ? " setup-segment-numeric" : ""}`} role="group" aria-label={ariaLabel}>
    {values.map(option => <button key={option} type="button" data-choice={option} title={describe?.(option) ?? label(option)} aria-label={describe?.(option) ?? label(option)} aria-pressed={value === option} onClick={() => onChange(option)}>{label(option)}</button>)}
  </div>;
}
