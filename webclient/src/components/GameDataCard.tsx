import { t, number } from "../i18n";
import type { GameSnapshot } from "../types";

function GameDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;
  const matchTargetWins = score?.matchTargetWins ?? 3;
  const gameTargetPoints = score?.gameTargetPoints ?? 1001;

  return (
    <section className="game-data-card">
      <div className="game-data-grid">
        <section className="game-data-section" data-team="opponent">
          <span className="panel-caption">{t("opponents")}</span>
          <strong title={score?.teamTwoName ?? t("Them")}>{score?.teamTwoName ?? t("Them")}</strong>
          <div className="data-list">
            <div className="data-row">
              <span className="data-label">{t("Wins")}</span>
              <span className="data-value"><span>{number(score?.teamTwoMatchScore ?? 0)}</span><small className="data-target">/{matchTargetWins}</small></span>
            </div>
            <div className="data-row">
              <span className="data-label">{t("Points")}</span>
              <span className="data-value"><span>{number(score?.teamTwoGamePoints ?? 0)}</span><small className="data-target">/{number(gameTargetPoints)}</small></span>
            </div>
            <div className="data-row">
              <span className="data-label">{t("Melds")}</span>
              <span className="data-value">{number(score?.teamTwoMeldPoints ?? 0)}</span>
            </div>
          </div>
        </section>
        <section className="game-data-section" data-team="your">
          <span className="panel-caption">{t("your team")}</span>
          <strong title={score?.teamOneName ?? t("Us")}>{score?.teamOneName ?? t("Us")}</strong>
          <div className="data-list">
            <div className="data-row">
              <span className="data-label">{t("Wins")}</span>
              <span className="data-value"><span>{number(score?.teamOneMatchScore ?? 0)}</span><small className="data-target">/{matchTargetWins}</small></span>
            </div>
            <div className="data-row">
              <span className="data-label">{t("Points")}</span>
              <span className="data-value"><span>{number(score?.teamOneGamePoints ?? 0)}</span><small className="data-target">/{number(gameTargetPoints)}</small></span>
            </div>
            <div className="data-row">
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
