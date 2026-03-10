import type { PlayerView } from "../types";
import PlayingCard from "./PlayingCard";

interface PlayerHandProps {
  player?: PlayerView;
  pendingType?: string;
  selectedIndex?: number | null;
  locked?: boolean;
  onPlayCard: (handIndex: number) => void;
}

const TOTAL_HAND_SLOTS = 8;

function PlayerHand({ player, pendingType, selectedIndex, locked, onPlayCard }: PlayerHandProps) {
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

    return {
      handIndex,
      card: player.hand[handIndex]
    };
  });

  return (
    <div className="player-hand-area">
      <div className="card-fan-row" data-card-count={player.hand.length}>
        {slots.map((slot, slotIndex) =>
          slot ? (
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
