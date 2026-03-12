import type { AnimatedTrickState, GameSnapshot } from "../types";

interface ScoreBarProps {
  snapshot: GameSnapshot | null;
  animatedTrick?: AnimatedTrickState | null;
  errorMessage: string | null;
}

function ScoreBar({ snapshot, animatedTrick, errorMessage }: ScoreBarProps) {
  const trump = toTrumpMeta(snapshot?.trumpSuit ?? null);
  const statusMessage = toStatusMessage(snapshot, animatedTrick);

  return (
    <section className="score-bar">
      <div className="score-item score-prompt">
        <span className="score-label">Status</span>
        <strong>{statusMessage}</strong>
        <small className="trump-line">
          trump{" "}
          {trump ? (
            <>
              <span className={`trump-suit-symbol ${trump.className}`}>{trump.symbol}</span> {trump.label}
            </>
          ) : (
            "pending"
          )}
        </small>
        {errorMessage ? <small className="error-line">{errorMessage}</small> : null}
      </div>
    </section>
  );
}

function toTrumpMeta(trumpSuit: string | null) {
  switch (trumpSuit) {
    case "SPADES":
      return { symbol: "\u2660", label: "spades", className: "spades" };
    case "HEARTS":
      return { symbol: "\u2665", label: "hearts", className: "hearts" };
    case "DIAMONDS":
      return { symbol: "\u2666", label: "diamonds", className: "diams" };
    case "CLUBS":
      return { symbol: "\u2663", label: "clubs", className: "clubs" };
    default:
      return null;
  }
}

function toStatusMessage(snapshot: GameSnapshot | null, animatedTrick: AnimatedTrickState | null | undefined) {
  if (!snapshot) {
    return "Waiting for the session to load.";
  }

  const southPlayer = snapshot.players.find((player) => player.seat === "SOUTH");
  const winningPlayer = animatedTrick?.winnerPlayerId
    ? snapshot.players.find((player) => player.id === animatedTrick.winnerPlayerId)
    : null;

  if (animatedTrick) {
    if (animatedTrick.phase === "placing") {
      return "Wait while the cards are being played.";
    }

    if (winningPlayer && southPlayer && winningPlayer.team === southPlayer.team) {
      return "Celebrate. Your team takes this trick.";
    }

    return "Congratulate them. They take this trick.";
  }

  switch (snapshot.pendingAction.type) {
    case "START_MATCH":
      return "Set the table and start the match.";
    case "START_NEXT_GAME":
      return "A new game is ready when you are.";
    case "CHOOSE_TRUMP":
      return "Choose a trump or skip.";
    case "REPORT_MELDS":
      return "Declare melds or pass.";
    case "ACKNOWLEDGE_MELDS":
      return "Review the melds and continue.";
    case "PLAY_CARD":
      return snapshot.pendingAction.actingPlayerId === southPlayer?.id
        ? "Play a legal card."
        : "Wait while the others are throwing.";
    default:
      return snapshot.pendingAction.prompt || "The table is ready.";
  }
}

export default ScoreBar;
