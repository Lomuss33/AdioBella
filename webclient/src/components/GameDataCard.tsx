import type { GameSnapshot } from "../types";

function GameDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;
  const matchTargetWins = score?.matchTargetWins ?? 3;
  const gameTargetPoints = score?.gameTargetPoints ?? 1001;

  return (
    <section className="game-data-card">
      <div className="game-data-grid">
        <section className="game-data-section">
          <span className="panel-caption">enemy</span>
          <strong>{score?.teamTwoName ?? "Them"}</strong>
          <div className="data-list">
            <div className="data-row">
              <span className="data-label">Wins</span>
              <span className="data-value">{score?.teamTwoMatchScore ?? 0}/{matchTargetWins}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Points</span>
              <span className="data-value">{score?.teamTwoGamePoints ?? 0}/{gameTargetPoints}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Melds</span>
              <span className="data-value">{score?.teamTwoMeldPoints ?? 0}</span>
            </div>
          </div>
        </section>
        <section className="game-data-section">
          <span className="panel-caption">your team</span>
          <strong>{score?.teamOneName ?? "Us"}</strong>
          <div className="data-list">
            <div className="data-row">
              <span className="data-label">Wins</span>
              <span className="data-value">{score?.teamOneMatchScore ?? 0}/{matchTargetWins}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Points</span>
              <span className="data-value">{score?.teamOneGamePoints ?? 0}/{gameTargetPoints}</span>
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
