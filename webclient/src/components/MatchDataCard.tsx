import type { GameSnapshot, MeldDeclarationView } from "../types";

function MatchDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;
  const melds = score?.meldDeclarations ?? [];
  const meldTeamName = melds[0]?.teamName ?? null;
  const gameGapPercent = score
    ? Math.min(100, Math.round((Math.abs(score.teamOneGamePoints - score.teamTwoGamePoints) / Math.max(score.gameTargetPoints, 1)) * 100))
    : 0;
  const difficultyLabel = (score?.difficulty ?? "NORMAL").toLowerCase();
  const matchTargetWins = score?.matchTargetWins ?? 3;
  const gameTargetPoints = score?.gameTargetPoints ?? 1001;
  const gameNumber = score?.gameNumber ?? 0;

  return (
    <section className="match-data-card">
      <div className="match-data-layout">
        <section className="match-data-section">
          <span className="panel-caption">match</span>
          <small>mode: {difficultyLabel}</small>
          <small>match: first to {matchTargetWins}</small>
          <small>race: {gameTargetPoints}</small>
          <small>game: #{gameNumber}</small>
          <small>swing: {gameGapPercent}%</small>
        </section>
        <section className="match-data-zvanje">
          <span className="panel-caption">melds</span>
          {melds.length === 0 ? <small>melds: none this game</small> : null}
          {meldTeamName ? <small>team: {meldTeamName} took melds</small> : null}
          {melds.map((meld) => (
            <small key={`${meld.playerId}-${meld.labels.join("-")}-${meld.belaPoints}`}>
              {formatMeld(meld)}
            </small>
          ))}
        </section>
      </div>
    </section>
  );
}

function formatMeld(meld: MeldDeclarationView) {
  const totalPoints = meld.meldPoints + meld.belaPoints;
  return `${meld.playerName}: ${totalPoints}`;
}

export default MatchDataCard;
