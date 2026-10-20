import { errorDescription } from "../i18n/presentation";
import { t, tr } from "../i18n";
import type { GameSnapshot } from "../types";
import MatchDataCard from "./MatchDataCard";
import type { ReactNode } from "react";

interface ScoreBarProps {
  snapshot: GameSnapshot | null;
  errorMessage: string | null;
  controls?: ReactNode;
}

function ScoreBar({ snapshot, errorMessage, controls }: ScoreBarProps) {
  const trump = toTrumpMeta(snapshot?.trumpSuit ?? null);

  return (
    <section className="score-bar table-console" aria-label={t("console.tableInformation")}>
      <div className="table-console-information">
        <div className="table-console-current">
          <div className={`trump-line table-trump${trump ? "" : " is-unset"}`}>
            <span className="table-trump-copy">
              <small className="table-console-label">{t("Trump")}</small>
              <span className={`trump-suit-symbol ${trump?.className ?? ""}`} aria-hidden="true">{trump?.symbol ?? "—"}</span>
              <strong>{trump ? tr(trump.label).replace(/^./, letter => letter.toUpperCase()) : t("console.notChosen")}</strong>
            </span>
          </div>
        </div>
        <MatchDataCard snapshot={snapshot} />
      </div>
      {controls}
      {errorMessage ? <small className="error-line table-console-error" role="alert">{errorDescription(errorMessage)}</small> : null}
    </section>
  );
}

function toTrumpMeta(trumpSuit: string | null) {
  switch (trumpSuit) {
    case "SPADES":
      return { symbol: "\u2660", label: "spades", className: "spades" };
    case "HEARTS":
      return { symbol: "\u2665", label: "hearts", className: "hearts" };
    case "DIAMONDS":
      return { symbol: "\u2666", label: "diamonds", className: "diams" };
    case "CLUBS":
      return { symbol: "\u2663", label: "clubs", className: "clubs" };
    default:
      return null;
  }
}

export default ScoreBar;
