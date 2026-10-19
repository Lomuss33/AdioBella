export type TeamSide = "your" | "opponent";

/** Ownership comes from the human player's team, never from who won. */
export function teamSide(team: string | null | undefined, yourTeam: string | null | undefined): TeamSide | undefined {
  if (!team || !yourTeam) return undefined;
  return team === yourTeam ? "your" : "opponent";
}

export function seatSide(seat: string | undefined): TeamSide | undefined {
  if (seat === "SOUTH" || seat === "NORTH") return "your";
  if (seat === "WEST" || seat === "EAST") return "opponent";
  return undefined;
}
