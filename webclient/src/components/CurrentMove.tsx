import { t } from "../i18n";
import { teamSide } from "../lib/teamSide";
import type { AnimatedTrickState, GameSnapshot } from "../types";

interface CurrentMoveProps {
  snapshot: GameSnapshot | null;
  animatedTrick?: AnimatedTrickState | null;
}

function CurrentMove({ snapshot, animatedTrick }: CurrentMoveProps) {
  const statusMessage = toStatusMessage(snapshot, animatedTrick);
  const human = snapshot?.players.find(player => player.seat === "SOUTH");
  const winner = animatedTrick?.phase !== "placing"
    ? snapshot?.players.find(player => player.id === animatedTrick?.winnerPlayerId) : undefined;
  const winnerSide = teamSide(winner?.team, human?.team);
  const humanTurn = human && snapshot?.pendingAction.type === "PLAY_CARD" && snapshot.pendingAction.actingPlayerId === human.id;
  const statusTone = animatedTrick ? (winnerSide ? "result" : "waiting")
    : humanTurn ? "action" : snapshot?.pendingAction.type && !["PLAY_CARD", "NONE"].includes(snapshot.pendingAction.type) ? "action" : "waiting";
  const turnDetail = humanTurn && !animatedTrick ? t("console.chooseCard") : statusMessage;

  return (
    <div className="terminal-current-move" role="status" data-status={statusTone} data-team={winnerSide}
      aria-live="polite" aria-label={statusMessage} title={statusMessage}>
      {turnDetail}
    </div>
  );
}

function toStatusMessage(snapshot: GameSnapshot | null, animatedTrick: AnimatedTrickState | null | undefined) {
  if (!snapshot) {
    return t("Waiting for the session to load.");
  }

  const southPlayer = snapshot.players.find((player) => player.seat === "SOUTH");
  const winningPlayer = animatedTrick?.winnerPlayerId
    ? snapshot.players.find((player) => player.id === animatedTrick.winnerPlayerId)
    : null;

  if (animatedTrick) {
    if (animatedTrick.phase === "placing") {
      return t("Cards are being played…");
    }

    if (winningPlayer && southPlayer && winningPlayer.team === southPlayer.team) {
      return t("Your team wins the trick.");
    }

    return t("Opponents win the trick.");
  }

  switch (snapshot.pendingAction.type) {
    case "START_MATCH":
      return t("Set the table and start the match.");
    case "START_NEXT_GAME":
      return t("A new game is ready when you are.");
    case "CHOOSE_TRUMP":
      return t("Choose a trump or skip.");
    case "REPORT_MELDS":
      return t("Declare melds or pass.");
    case "ACKNOWLEDGE_MELDS":
      return t("Review the melds and continue.");
    case "PLAY_CARD":
      return snapshot.pendingAction.actingPlayerId === southPlayer?.id
        ? t("Your turn — choose a highlighted card.")
        : t("Waiting for the next player…");
    default:
      return t("The table is ready.");
  }
}

export default CurrentMove;
