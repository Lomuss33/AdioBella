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
          <small>wins {score?.teamTwoMatchScore ?? 0}/{matchTargetWins}</small>
          <small>points {score?.teamTwoGamePoints ?? 0}/{gameTargetPoints}</small>
          <small>melds {score?.teamTwoMeldPoints ?? 0}</small>
        </section>
        <section className="game-data-section">
          <span className="panel-caption">your team</span>
          <strong>{score?.teamOneName ?? "Us"}</strong>
          <small>wins {score?.teamOneMatchScore ?? 0}/{matchTargetWins}</small>
          <small>points {score?.teamOneGamePoints ?? 0}/{gameTargetPoints}</small>
          <small>melds {score?.teamOneMeldPoints ?? 0}</small>
        </section>
      </div>
    </section>
  );
}

export default GameDataCard;
