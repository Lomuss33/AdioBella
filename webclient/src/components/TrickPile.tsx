import { cardKey, cardPoints, toRenderedTrickCards } from "../lib/trickAnimation";
import type { AnimatedTrickState, TrickView } from "../types";
import PlayingCard from "./PlayingCard";

interface TrickPileProps {
  trick: TrickView;
  trumpSuit?: string | null;
  animatedTrick?: AnimatedTrickState | null;
}

function TrickPile({ trick, trumpSuit, animatedTrick }: TrickPileProps) {
  const renderedCards = toRenderedTrickCards(animatedTrick ?? null, trick.cards);
  const staticPoints = renderedCards.reduce((total, playedCard) => total + cardPoints(playedCard.card, trumpSuit ?? null), 0);
  const showPointsChip = animatedTrick?.pointsVisible || staticPoints > 0;
  const pointsValue = animatedTrick ? animatedTrick.pointsDisplay : staticPoints;

  return (
    <div className="trick-pool">
      <span className="panel-caption">Table</span>
      <div
        className={[
          "trick-cards",
          animatedTrick ? "trick-cards-animated" : "",
          animatedTrick ? `phase-${animatedTrick.phase}` : "",
          animatedTrick?.winnerSeat ? `winner-${animatedTrick.winnerSeat.toLowerCase()}` : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {renderedCards.map((playedCard, index) => {
          const isAnimatedPlay = animatedTrick ? index >= animatedTrick.baseCards.length : false;
          const key = cardKey(playedCard);
          return (
            <div
              key={key}
              className={[
                "trick-card-stack",
                `trick-seat-${playedCard.seat.toLowerCase()}`,
                isAnimatedPlay ? "animated-play" : "",
                animatedTrick?.winningCardKey === key && animatedTrick.phase !== "placing" ? "winning-stack" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={isAnimatedPlay ? { animationDuration: `${animatedTrick?.plays[index - (animatedTrick?.baseCards.length ?? 0)]?.durationMs ?? 220}ms` } : undefined}
            >
              <PlayingCard
                card={playedCard.card}
                disabled
                highlighted={animatedTrick?.winningCardKey === key && animatedTrick.phase !== "placing"}
              />
            </div>
          );
        })}
      </div>
      {showPointsChip ? (
        <div
          className={[
            "trick-points-chip",
            animatedTrick?.pointsPulse ? "pulse" : "",
            animatedTrick?.phase === "collecting" && animatedTrick.winnerSeat ? `collect-${animatedTrick.winnerSeat.toLowerCase()}` : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          +{pointsValue}
        </div>
      ) : null}
    </div>
  );
}

export default TrickPile;
