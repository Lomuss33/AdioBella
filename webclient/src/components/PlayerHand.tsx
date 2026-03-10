import type { PlayerView } from "../types";
import PlayingCard from "./PlayingCard";

interface PlayerHandProps {
  player?: PlayerView;
  pendingType?: string;
  selectedIndex?: number | null;
  hiddenIndex?: number | null;
  locked?: boolean;
  winnerGlow?: boolean;
  showDealer?: boolean;
  showTrumpCaller?: boolean;
  onPlayCard: (handIndex: number) => void;
}

const TOTAL_HAND_SLOTS = 8;

function PlayerHand({
  player,
  pendingType,
  selectedIndex,
  hiddenIndex,
  locked,
  winnerGlow,
  showDealer,
  showTrumpCaller,
  onPlayCard
}: PlayerHandProps) {
  if (!player) {
    return null;
  }

  const choosingCard = pendingType === "PLAY_CARD" && !locked;
  const leadingEmptySlots = Math.floor((TOTAL_HAND_SLOTS - player.hand.length) / 2);
  const slots = Array.from({ length: TOTAL_HAND_SLOTS }, (_, slotIndex) => {
    const handIndex = slotIndex - leadingEmptySlots;
    if (handIndex < 0 || handIndex >= player.hand.length) {
      return null;
    }

    if (hiddenIndex !== null && handIndex === hiddenIndex) {
      return {
        handIndex,
        card: null
      };
    }

    return {
      handIndex,
      card: player.hand[handIndex]
    };
  });

  return (
    <div className="player-hand-area">
      <div className={`south-inline-info ${winnerGlow ? "south-inline-info-winner" : ""}`.trim()}>
        <span className="south-inline-side south-inline-left">
          {showDealer ? <span className="south-inline-badge">dealer</span> : null}
        </span>
        <div className="south-inline-main">
          <span className="south-inline-seat">{player.seat}</span>
          <span className="south-inline-separator">:</span>
          <strong>{player.name}</strong>
          <span className="south-inline-separator">:</span>
          <span>{player.team}</span>
        </div>
        <span className="south-inline-side south-inline-right">
          {showTrumpCaller ? <span className="south-inline-badge south-inline-badge-trump">trump</span> : null}
        </span>
      </div>
      <div className="card-fan-row" data-card-count={player.hand.length - (hiddenIndex !== null ? 1 : 0)}>
        {slots.map((slot, slotIndex) =>
          slot && slot.card ? (
            <div key={`slot-${slotIndex}-${slot.card.label}`} className="hand-slot">
              <PlayingCard
                card={slot.card}
                disabled={!slot.card.playable || pendingType !== "PLAY_CARD" || locked}
                selected={selectedIndex === slot.handIndex}
                legalChoice={choosingCard && slot.card.playable}
                blockedChoice={choosingCard && !slot.card.playable}
                onClick={() => onPlayCard(slot.handIndex)}
              />
            </div>
          ) : slot ? (
            <div key={`slot-${slotIndex}-hidden`} className="hand-slot hand-slot-hidden" aria-hidden="true" />
          ) : (
            <div key={`slot-${slotIndex}`} className="hand-slot hand-slot-empty" aria-hidden="true" />
          )
        )}
      </div>
    </div>
  );
}

export default PlayerHand;
