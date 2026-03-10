import type { PlayerView } from "../types";

function SouthPlayerInfo({
  player,
  winnerGlow,
  showDealer,
  showTrumpCaller
}: {
  player?: PlayerView;
  winnerGlow?: boolean;
  showDealer?: boolean;
  showTrumpCaller?: boolean;
}) {
  if (!player) {
    return null;
  }

  return (
    <div className={`seat-panel seat-south south-player-panel ${winnerGlow ? "seat-winner-glow" : ""}`.trim()}>
      <span className="panel-caption seat-direction-label">{player.seat}</span>
      <div className="seat-main-copy">
        <strong>{player.name}</strong>
        <small>{player.team}</small>
        <small>{player.handSize} cards</small>
      </div>
      {(showDealer || showTrumpCaller) ? (
        <div className="seat-badges">
          {showDealer ? <span className="seat-badge">dealer</span> : null}
          {showTrumpCaller ? <span className="seat-badge seat-badge-trump">trump</span> : null}
        </div>
      ) : null}
      <div className="seat-status-line">{player.currentTurn ? "current turn" : "waiting"}</div>
    </div>
  );
}

export default SouthPlayerInfo;
