import type { GameSnapshot, MeldDeclarationView } from "../types";

function MatchDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;
  const melds = score?.meldDeclarations ?? [];
  const gameGapPercent = score
    ? Math.min(100, Math.round((Math.abs(score.teamOneGamePoints - score.teamTwoGamePoints) / Math.max(score.gameTargetPoints, 1)) * 100))
    : 0;

  return (
    <section className="match-data-card">
      <div className="match-data-layout">
        <section className="match-data-section">
          <span className="panel-caption">match</span>
          <small>difficulty {(score?.difficulty ?? "NORMAL").toLowerCase()}</small>
          <small>game count {score?.gameNumber ?? 0}</small>
          <small>current gap {gameGapPercent}%</small>
        </section>
        <section className="match-data-zvanje">
          <span className="panel-caption">zvanje</span>
          {melds.length === 0 ? <small>none declared yet</small> : null}
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
  const labels = meld.labels.length > 0 ? meld.labels.join(", ") : "bela";
  const extras = meld.belaPoints > 0 ? ` + bela ${meld.belaPoints}` : "";
  const totalPoints = meld.meldPoints + meld.belaPoints;
  return `${meld.playerName} (${meld.teamName}): ${labels}${extras} = ${totalPoints}`;
}

export default MatchDataCard;
