import type { GameSnapshot } from "../types";

function GameDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;
  const matchTargetWins = score?.matchTargetWins ?? 3;
  const gameTargetPoints = score?.gameTargetPoints ?? 1001;

  return (
    <section className="game-data-card">
      <div className="game-data-grid">
        <section className="game-data-section" data-team="opponent">
          <span className="panel-caption">opponents</span>
          <strong title={score?.teamTwoName ?? "Them"}>{score?.teamTwoName ?? "Them"}</strong>
          <div className="data-list">
            <div className="data-row">
              <span className="data-label">Wins</span>
              <span className="data-value"><span>{score?.teamTwoMatchScore ?? 0}</span><small className="data-target">/{matchTargetWins}</small></span>
            </div>
            <div className="data-row">
              <span className="data-label">Points</span>
              <span className="data-value"><span>{score?.teamTwoGamePoints ?? 0}</span><small className="data-target">/{gameTargetPoints}</small></span>
            </div>
            <div className="data-row">
              <span className="data-label">Melds</span>
              <span className="data-value">{score?.teamTwoMeldPoints ?? 0}</span>
            </div>
          </div>
        </section>
        <section className="game-data-section" data-team="your">
          <span className="panel-caption">your team</span>
          <strong title={score?.teamOneName ?? "Us"}>{score?.teamOneName ?? "Us"}</strong>
          <div className="data-list">
            <div className="data-row">
              <span className="data-label">Wins</span>
              <span className="data-value"><span>{score?.teamOneMatchScore ?? 0}</span><small className="data-target">/{matchTargetWins}</small></span>
            </div>
            <div className="data-row">
              <span className="data-label">Points</span>
              <span className="data-value"><span>{score?.teamOneGamePoints ?? 0}</span><small className="data-target">/{gameTargetPoints}</small></span>
            </div>
            <div className="data-row">
              <span className="data-label">Melds</span>
              <span className="data-value">{score?.teamOneMeldPoints ?? 0}</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default GameDataCard;
