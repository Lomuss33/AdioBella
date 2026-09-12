import type { PlayerView, Seat } from "../types";
import SeatMarker from "./SeatMarker";

interface SeatPanelProps {
  player?: PlayerView;
  seat?: Seat;
  winnerGlow?: boolean;
  showDealer?: boolean;
  showTrumpCaller?: boolean;
}

function SeatPanel({ player, seat, winnerGlow, showDealer, showTrumpCaller }: SeatPanelProps) {
  if (!player) {
    return <div className={`seat-panel seat-${(seat ?? "NORTH").toLowerCase()} seat-loading`}>Loading seat…</div>;
  }

  return (
    <div
      data-team={player.seat === "NORTH" || player.seat === "SOUTH" ? "your" : "opponent"}
      className={[
        "seat-panel",
        `seat-${player.seat.toLowerCase()}`,
        player.currentTurn ? "seat-active" : "",
        winnerGlow ? "seat-winner-glow" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SeatMarker seat={player.seat} active={player.currentTurn} winner={winnerGlow} playerName={player.name} />
      <div className="seat-main-copy">
        <strong title={player.name}>{player.name}</strong>
        <small title={player.team}>{player.team} · {player.handSize} cards</small>
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
