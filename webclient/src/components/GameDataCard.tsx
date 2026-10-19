import { t, number } from "../i18n";
import type { GameSnapshot } from "../types";

function GameDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;

  return (
    <section className="game-data-card">
      <div className="game-data-grid">
        <section className="game-data-section" data-team="opponent">
          <div className="game-data-team-heading">
            <span className="panel-caption">{t("opponents")}</span>
            <strong title={score?.teamTwoName ?? t("Them")}>{score?.teamTwoName ?? t("Them")}</strong>
          </div>
          <div className="data-list">
            <div className="data-row" data-stat="melds">
              <span className="data-label">{t("Melds")}</span>
              <span className="data-value">{number(score?.teamTwoMeldPoints ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="points">
              <span className="data-label">{t("Points")}</span>
              <span className="data-value">{number(score?.teamTwoGamePoints ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="wins">
              <span className="data-label">{t("Wins")}</span>
              <span className="data-value">{number(score?.teamTwoMatchScore ?? 0)}</span>
            </div>
          </div>
        </section>
        <section className="game-data-section" data-team="your">
          <div className="game-data-team-heading">
            <strong title={score?.teamOneName ?? t("Us")}>{score?.teamOneName ?? t("Us")}</strong>
            <span className="panel-caption">{t("your team")}</span>
          </div>
          <div className="data-list">
            <div className="data-row" data-stat="wins">
              <span className="data-label">{t("Wins")}</span>
              <span className="data-value">{number(score?.teamOneMatchScore ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="points">
              <span className="data-label">{t("Points")}</span>
              <span className="data-value">{number(score?.teamOneGamePoints ?? 0)}</span>
            </div>
            <div className="data-row" data-stat="melds">
              <span className="data-label">{t("Melds")}</span>
              <span className="data-value">{number(score?.teamOneMeldPoints ?? 0)}</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default GameDataCard;
