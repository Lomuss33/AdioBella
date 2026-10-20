import { t } from "../i18n";
import type { PlayerView } from "../types";
import { HAND_CAPACITY } from "../lib/handLayout";
import { useHandReflow } from "../lib/useHandReflow";
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

const HAND_SPACES = Array.from({ length: HAND_CAPACITY }, (_, index) => index);

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
  const choosingCard = pendingType === "PLAY_CARD" && !locked;
  const visibleCards = (player?.hand ?? [])
    .map((card, handIndex) => (hiddenIndex !== null && handIndex === hiddenIndex ? null : { handIndex, card }))
    .filter((slot): slot is { handIndex: number; card: PlayerView["hand"][number] } => slot !== null)
    .map(slot => ({ ...slot, key: `card-${slot.card.suit}-${slot.card.rank}-${slot.card.label}` }));
  const rowRef = useHandReflow(player?.id, visibleCards.map(slot => slot.key));

  if (!player) return null;

  return (
    <div
      className={["player-hand-area", player.currentTurn ? "seat-active" : "", winnerGlow ? "seat-winner-glow" : ""].filter(Boolean).join(" ")}
      data-team="your" role="group" aria-label={t("Your hand")}
    >
      <div className="player-hand-decoration" aria-hidden="true" />
      <div ref={rowRef} className="card-fan-row" data-card-count={visibleCards.length}
        data-layout-count={pendingType === "CHOOSE_TRUMP" ? HAND_CAPACITY : visibleCards.length}>
        {HAND_SPACES.map(index => <div key={`space-${index}`} className="hand-slot hand-slot-empty" aria-hidden="true" />)}
        {visibleCards.map(slot => (
          <div key={slot.key} className="hand-card-slot" data-card-key={slot.key}>
            <PlayingCard
              card={slot.card}
              disabled={!slot.card.playable || pendingType !== "PLAY_CARD" || locked}
              selected={selectedIndex === slot.handIndex}
              legalChoice={choosingCard && slot.card.playable}
              blockedChoice={choosingCard && !slot.card.playable}
              onClick={() => onPlayCard(slot.handIndex)}
            />
          </div>
        ))}
      </div>
      <div className={`south-inline-info ${winnerGlow ? "south-inline-info-winner" : ""}`.trim()}>
        <span className="south-player-team" title={player.team}>{player.team}</span>
        <strong className="south-player-name" title={player.name}>{player.name}</strong>
        <div className="south-inline-status-row">
          <span
            className={`south-inline-badge ${showDealer ? "" : "south-inline-badge-placeholder"}`.trim()}
            aria-hidden={showDealer ? undefined : true}
          >
            {showDealer ? t("dealer") : ""}
          </span>
          <span
            className={`south-inline-badge south-inline-badge-trump ${showTrumpCaller ? "" : "south-inline-badge-placeholder"}`.trim()}
            aria-hidden={showTrumpCaller ? undefined : true}
          >
            {t("trump")}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PlayerHand;
