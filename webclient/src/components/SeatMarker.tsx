import type { Seat } from "../types";

const POSITION = {
  NORTH: { angle: 0, label: "Across the table" },
  EAST: { angle: 90, label: "Right of the table" },
  SOUTH: { angle: 180, label: "Your side of the table" },
  WEST: { angle: 270, label: "Left of the table" }
} satisfies Record<Seat, { angle: number; label: string }>;

/** A miniature table locates the player without exposing internal seat names. */
export default function SeatMarker({ seat, active = false, winner = false, playerName, backdrop = false }: {
  seat: Seat;
  active?: boolean;
  winner?: boolean;
  playerName?: string;
  backdrop?: boolean;
}) {
  const position = POSITION[seat];
  const label = `${playerName ? `${playerName}, ` : ""}${position.label}${active ? ", playing now" : ""}${winner ? ", trick winner" : ""}`;

  return (
    <svg
      className={`seat-marker${active ? " seat-marker-active" : ""}${winner ? " seat-marker-winner" : ""}`}
      viewBox="0 0 32 32"
      width="20"
      height="20"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {backdrop ? (
        <g transform={`rotate(${position.angle} 16 16)`} className="seat-backdrop-pointer">
          <path className="seat-backdrop-chevron" d="M2 2 L16 16 L30 2 L30 11 L16 25 L2 11 Z" />
          <path className="seat-backdrop-echo" d="M2 17 L16 31 L30 17" />
        </g>
      ) : <>
      <rect className="seat-marker-table" x="8" y="8" width="16" height="16" rx="6" />
      <g className="seat-marker-places">
        <circle cx="16" cy="3.5" r="1.5" />
        <circle cx="28.5" cy="16" r="1.5" />
        <circle cx="16" cy="28.5" r="1.5" />
        <circle cx="3.5" cy="16" r="1.5" />
      </g>
      <g transform={`rotate(${position.angle} 16 16)`}>
        <path className="seat-marker-trail" d="M16 7 L16 13" pathLength="1" />
        <path className="seat-marker-pointer" d="M13 10 L16 13 L19 10" />
        <circle className="seat-marker-halo" cx="16" cy="3.5" r="3" />
        <circle className="seat-marker-dot" cx="16" cy="3.5" r="2.2" />
      </g>
      </>}
    </svg>
  );
}
