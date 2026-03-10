import type { GameSnapshot } from "../types";

function GameDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;

  return (
    <section className="game-data-card">
      <div className="game-data-grid">
        <section className="game-data-section">
          <span className="panel-caption">enemy team</span>
          <strong>{score?.teamTwoName ?? "Them"}</strong>
          <small>match {score?.teamTwoMatchScore ?? 0}</small>
          <small>game {score?.teamTwoGamePoints ?? 0}</small>
          <small>zvanje {score?.teamTwoMeldPoints ?? 0}</small>
        </section>
        <section className="game-data-section">
          <span className="panel-caption">your team</span>
          <strong>{score?.teamOneName ?? "Us"}</strong>
          <small>match {score?.teamOneMatchScore ?? 0}</small>
          <small>game {score?.teamOneGamePoints ?? 0}</small>
          <small>zvanje {score?.teamOneMeldPoints ?? 0}</small>
        </section>
      </div>
    </section>
  );
}

export default GameDataCard;
