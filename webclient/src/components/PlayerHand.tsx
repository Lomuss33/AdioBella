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
  const visibleCards = player.hand
    .map((card, handIndex) => (hiddenIndex !== null && handIndex === hiddenIndex ? null : { handIndex, card }))
    .filter((slot): slot is { handIndex: number; card: PlayerView["hand"][number] } => slot !== null);
  const leadingEmptySlots = Math.floor((TOTAL_HAND_SLOTS - visibleCards.length) / 2);
  const slots = Array.from({ length: TOTAL_HAND_SLOTS }, (_, slotIndex) => {
    const visibleIndex = slotIndex - leadingEmptySlots;
    if (visibleIndex < 0 || visibleIndex >= visibleCards.length) {
      return null;
    }

    return visibleCards[visibleIndex];
  });

  return (
    <div className="player-hand-area">
      <div className={`south-inline-info ${winnerGlow ? "south-inline-info-winner" : ""}`.trim()}>
        <div className="south-inline-status-row">
          <span className="south-inline-side south-inline-left">
            <span
              className={`south-inline-badge ${showDealer ? "" : "south-inline-badge-placeholder"}`.trim()}
              aria-hidden={showDealer ? undefined : true}
            >
              {showDealer ? "dealer" : ""}
            </span>
          </span>
          <span className="south-inline-side south-inline-right">
            <span
              className={`south-inline-badge south-inline-badge-trump ${showTrumpCaller ? "" : "south-inline-badge-placeholder"}`.trim()}
              aria-hidden={showTrumpCaller ? undefined : true}
            >
              {showTrumpCaller ? "trump" : ""}
            </span>
          </span>
        </div>
        <div className="south-inline-main">
          <span className="south-inline-seat">{player.seat}</span>
          <span className="south-inline-separator">:</span>
          <strong>{player.name}</strong>
          <span className="south-inline-separator">:</span>
          <span>{player.team}</span>
        </div>
      </div>
      <div className="card-fan-row" data-card-count={visibleCards.length}>
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
          ) : (
            <div key={`slot-${slotIndex}`} className="hand-slot hand-slot-empty" aria-hidden="true" />
          )
        )}
      </div>
    </div>
  );
}

export default PlayerHand;
