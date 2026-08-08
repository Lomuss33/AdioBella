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
          <div className="data-list">
            <div className="data-row">
              <span className="data-label">Mode</span>
              <span className="data-value">{difficultyLabel}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Match</span>
              <span className="data-value">first to {matchTargetWins}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Race</span>
              <span className="data-value">{gameTargetPoints}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Game</span>
              <span className="data-value">#{gameNumber}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Swing</span>
              <span className="data-value">{gameGapPercent}%</span>
            </div>
          </div>
        </section>
        <section className="match-data-zvanje">
          <span className="panel-caption">melds</span>
          <div className="data-list">
            {melds.length === 0 ? (
              <div className="data-row">
                <span className="data-label">Melds</span>
                <span className="data-value">none this game</span>
              </div>
            ) : null}
            {meldTeamName ? (
              <div className="data-row">
                <span className="data-label">Team</span>
                <span className="data-value">{meldTeamName} took melds</span>
              </div>
            ) : null}
            {melds.map((meld) => (
              <div className="data-row" key={`${meld.playerId}-${meld.labels.join("-")}-${meld.belaPoints}`}>
                <span className="data-label">Meld</span>
                <span className="data-value">{formatMeld(meld)}</span>
              </div>
            ))}
          </div>
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
