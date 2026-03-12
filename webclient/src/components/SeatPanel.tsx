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
      <div className="seat-badges">
        <span className={`seat-badge ${showDealer ? "" : "seat-badge-placeholder"}`.trim()} aria-hidden={showDealer ? undefined : true}>
          {showDealer ? "dealer" : ""}
        </span>
        <span
          className={`seat-badge seat-badge-trump ${showTrumpCaller ? "" : "seat-badge-placeholder"}`.trim()}
          aria-hidden={showTrumpCaller ? undefined : true}
        >
          {showTrumpCaller ? "trump" : ""}
        </span>
      </div>
    </div>
  );
}

export default SeatPanel;
