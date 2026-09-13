import { errorDescription } from "../i18n/presentation";
import { t, tr } from "../i18n";
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
        <div className="score-header">
          <span className="score-label">{t("Status")}</span>
          <small className="trump-line">{t("trump")}{" "}
            {trump ? (
              <>
                <span className={`trump-suit-symbol ${trump.className}`}>{trump.symbol}</span> {tr(trump.label)}
              </>
            ) : (
              t("pending")
            )}
          </small>
        </div>
        <strong role="status" aria-live="polite" title={statusMessage}>{statusMessage}</strong>
        {errorMessage ? <small className="error-line" role="alert">{errorDescription(errorMessage)}</small> : null}
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

export default ScoreBar;
