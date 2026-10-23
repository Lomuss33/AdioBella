import { cardKey, cardPoints, toRenderedTrickCards } from "../lib/trickAnimation";
import type { AnimatedTrickState, TrickView } from "../types";
import PlayingCard from "./PlayingCard";
import type { CSSProperties, ReactNode } from "react";
import { CARD_TIMING } from "../lib/cardAnimationConfig";
import { trickLeader } from "../lib/trickLeader";
import { seatSide } from "../lib/teamSide";
import { useTrickMotion } from "../lib/useTrickMotion";

interface TrickPileProps {
  trick: TrickView;
  trumpSuit?: string | null;
  animatedTrick?: AnimatedTrickState | null;
  children?: ReactNode;
}

function TrickPile({ trick, trumpSuit, animatedTrick, children }: TrickPileProps) {
  const renderedCards = toRenderedTrickCards(animatedTrick ?? null, trick.cards);
  const cardsRef = useTrickMotion(animatedTrick, renderedCards.map(cardKey));
  const staticPoints = renderedCards.reduce((total, playedCard) => total + cardPoints(playedCard.card, trumpSuit ?? null), 0);
  const showPointsChip = animatedTrick?.phase !== "resting" && (animatedTrick?.pointsVisible || staticPoints > 0);
  const pointsValue = animatedTrick ? animatedTrick.pointsDisplay : staticPoints;
  const leadingSeat = animatedTrick && animatedTrick.phase !== "placing" && animatedTrick.winnerSeat
    ? animatedTrick.winnerSeat : trickLeader(renderedCards, trumpSuit ?? null)?.seat;

  return (
    <div className="trick-pool-shell" style={{
      "--trick-collect-duration": `${animatedTrick?.resolution?.collectDurationMs ?? CARD_TIMING.collectionMs}ms`,
      "--trick-points-pulse-duration": `${CARD_TIMING.pointsPulseMs}ms`
    } as CSSProperties}>
      {children}
      <div className="trick-pool">
        <span className="trick-size-guide" aria-hidden="true" />
        <div
          ref={cardsRef}
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
            const animatedPlayIndex = animatedTrick ? index - animatedTrick.baseCards.length : -1;
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
                style={
                  isAnimatedPlay
                    ? { ["--card-entry-duration" as string]: `${animatedTrick?.plays[animatedPlayIndex]?.durationMs ?? 220}ms` }
                    : undefined
                }
              >
                <PlayingCard
                  card={playedCard.card}
                  ownerName={playedCard.playerName}
                  disabled
                  highlighted={animatedTrick?.winningCardKey === key && animatedTrick.phase !== "placing"}
                />
              </div>
            );
          })}
        </div>
      </div>
      {showPointsChip ? (
        <div
          data-team={seatSide(leadingSeat)}
          className={[
            "trick-points-chip",
            animatedTrick?.pointsPulse ? "pulse" : "",
            animatedTrick?.phase === "collecting" && animatedTrick.winnerSeat ? `collect-${animatedTrick.winnerSeat.toLowerCase()}` : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="trick-points-value">
            <span className="trick-points-plus">+</span>{pointsValue}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default TrickPile;
