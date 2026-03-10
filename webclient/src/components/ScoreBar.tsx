import type { GameSnapshot } from "../types";

interface ScoreBarProps {
  snapshot: GameSnapshot | null;
  pendingPrompt?: string;
  errorMessage: string | null;
}

function ScoreBar({ snapshot, pendingPrompt, errorMessage }: ScoreBarProps) {
  const currentPlayer = snapshot?.players.find((player) => player.id === snapshot.currentPlayerId);
  const trump = toTrumpMeta(snapshot?.trumpSuit ?? null);

  return (
    <section className="score-bar">
      <div className="score-item score-prompt">
        <span className="score-label">Status</span>
        <strong>{pendingPrompt || "Waiting for the session to load."}</strong>
        {currentPlayer ? <small>current player {currentPlayer.name}</small> : null}
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

export default ScoreBar;
