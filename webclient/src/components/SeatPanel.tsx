import type { PlayerView } from "../types";

interface SeatPanelProps {
  player?: PlayerView;
  winnerGlow?: boolean;
  showDealer?: boolean;
  showTrumpCaller?: boolean;
}

function SeatPanel({ player, winnerGlow, showDealer, showTrumpCaller }: SeatPanelProps) {
  if (!player) {
    return <div className="seat-panel seat-loading">Loading seat...</div>;
  }

  return (
    <div
      className={[
        "seat-panel",
        `seat-${player.seat.toLowerCase()}`,
        player.currentTurn ? "seat-active" : "",
        winnerGlow ? "seat-winner-glow" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="panel-caption seat-direction-label">{player.seat}</span>
      <div className="seat-main-copy">
        <strong>{player.name}</strong>
        <small>{player.team}</small>
      </div>
      {(showDealer || showTrumpCaller) ? (
        <div className="seat-badges">
          {showDealer ? <span className="seat-badge">dealer</span> : null}
          {showTrumpCaller ? <span className="seat-badge seat-badge-trump">trump</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default SeatPanel;
