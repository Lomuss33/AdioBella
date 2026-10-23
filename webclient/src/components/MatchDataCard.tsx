import { t, number, countText } from "../i18n";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { GameSnapshot } from "../types";
import MeldDetails from "./MeldDetails";

export default function MatchDataCard({ snapshot, children, informationLabel }: {
  snapshot: GameSnapshot | null;
  children: ReactNode;
  informationLabel: string;
}) {
  const [showMelds, setShowMelds] = useState(false);
  const score = snapshot?.score;
  const gameTitle = t(score?.difficulty === "HARD" ? "gameHeading.hard" : score?.difficulty === "EASY" ? "gameHeading.easy" : "gameHeading.normal", { count: score?.gameNumber || "—" });
  const difficulty = t(score?.difficulty === "HARD" ? "hard" : score?.difficulty === "EASY" ? "easy" : "normal");
  const wins = score?.matchTargetWins ?? 3;
  const points = score?.gameTargetPoints ?? 1001;
  const summaryKey = wins === 1 ? "matchSummary.one" : wins < 5 ? "matchSummary.few" : "matchSummary.other";
  const summary = t(summaryKey, { wins, points });
  return (
    <>
      <button
        type="button"
        className="match-data-card table-console-information"
        aria-haspopup="dialog"
        aria-expanded={showMelds}
        aria-label={`${t("Meld details")}: ${informationLabel}, ${gameTitle}, ${summary}`}
        title={t("Meld details")}
        onClick={event => { event.currentTarget.focus({ preventScroll: true }); setShowMelds(true); }}
      >
        {children}
        <span className="match-summary">
          <span className="match-summary-heading">
            <strong className="match-summary-title">{t("gameNumber", { count: score?.gameNumber || "—" })}</strong>
            <small className="match-summary-difficulty">{difficulty}</small>
          </span>
          <span className="match-summary-targets" title={summary}>
            <span className="match-summary-goals">
              <span className="match-summary-goal">
                <strong>{number(wins)}</strong>
                <small>{countText("wins", wins).slice(number(wins).length).trim()}</small>
              </span>
              <span className="match-summary-separator" aria-hidden="true">·</span>
              <span className="match-summary-goal">
                <strong>{number(points)}</strong>
                <small>{t("console.pointsUnit")}</small>
              </span>
            </span>
          </span>
        </span>
        <svg className="match-summary-open table-console-open" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m7 5 5 5-5 5" />
        </svg>
      </button>
      {showMelds && createPortal(
        <MeldDetails melds={score?.meldDeclarations ?? []}
          yourTeam={snapshot?.players.find(player => player.seat === "SOUTH")?.team}
          onClose={() => setShowMelds(false)} />,
        document.body
      )}
    </>
  );
}
