import type { GameSnapshot } from "../types";

export default function MatchDataCard({ snapshot }: { snapshot: GameSnapshot | null }) {
  const score = snapshot?.score;
  const melds = score?.meldDeclarations ?? [];
  return (
    <details className="match-data-card">
      <summary>
        <span className="match-summary-title">Game {score?.gameNumber || "—"}</span>
        <span>{(score?.difficulty ?? "NORMAL").toLowerCase()}</span>
        <span>first to {score?.matchTargetWins ?? 3}</span>
        <span>{score?.gameTargetPoints ?? 1001} points</span>
        <span className="match-details-label">Meld details</span>
      </summary>
      <div className="match-meld-details">
        {melds.length === 0 ? <p>No melds declared this game.</p> : melds.map((meld) => (
          <div key={`${meld.playerId}-${meld.labels.join("-")}-${meld.belaPoints}`}>
            <span>{meld.playerName} · {meld.teamName}</span>
            <strong>{meld.meldPoints + meld.belaPoints} points</strong>
          </div>
        ))}
      </div>
    </details>
  );
}