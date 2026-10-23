import { countText, number, t } from "../i18n";

/** The winning partnership and each player's award share one identity/score row. */
export default function MeldSummary({ kind, caption, name, points, className = "" }: {
  kind: "team" | "player";
  caption: string;
  name: string;
  points: number;
  className?: string;
}) {
  return <div className={`meld-summary ${className}`.trim()} data-summary-kind={kind}>
    <div className={`meld-${kind}-identity`}>
      <span>{caption}</span>
      <strong>{name}</strong>
    </div>
    <div className="meld-player-total" aria-label={countText("points", points)}>
      <strong>{number(points)}</strong>
      <span>{t("points")}</span>
    </div>
  </div>;
}
