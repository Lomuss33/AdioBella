import { useLayoutEffect, type CSSProperties } from "react";
import { t } from "../i18n";
import type { PlayerView } from "../types";
import { HAND_CAPACITY } from "../lib/handLayout";
import { useHandReflow } from "../lib/useHandReflow";
import { DEAL_HIGHLIGHT_MS, useNewlyDealtCards } from "../lib/useNewlyDealtCards";
import PlayingCard from "./PlayingCard";
import { usePlayback } from "./PlaybackContext";
import { playbackRate } from "../lib/playback";

interface PlayerHandProps {
  player?: PlayerView;
  pendingType?: string;
  trumpSuit?: string | null;
  selectedIndex?: number | null;
  hiddenIndex?: number | null;
  locked?: boolean;
  winnerGlow?: boolean;
  showDealer?: boolean;
  showTrumpCaller?: boolean;
  onPlayCard: (handIndex: number) => void;
}

const HAND_SPACES = Array.from({ length: HAND_CAPACITY }, (_, index) => index);
const DEAL_HIGHLIGHT_STYLE = { "--hand-deal-duration": `${DEAL_HIGHLIGHT_MS}ms` } as CSSProperties;

function PlayerHand({
  player,
  pendingType,
  trumpSuit,
  selectedIndex,
  hiddenIndex,
  locked,
  winnerGlow,
  showDealer,
  showTrumpCaller,
  onPlayCard
}: PlayerHandProps) {
  const { settings } = usePlayback();
  const rate = playbackRate(settings.speed);
  const choosingCard = pendingType === "PLAY_CARD" && !locked;
  const handCards = (player?.hand ?? []).map((card, handIndex) => ({
    card, handIndex, key: `card-${card.suit}-${card.rank}-${card.label}`
  }));
  const visibleCards = handCards.filter(slot => slot.handIndex !== hiddenIndex);
  const rowRef = useHandReflow(player?.id, visibleCards.map(slot => slot.key));
  const newlyDealt = useNewlyDealtCards(player?.id, handCards.map(slot => slot.key), trumpSuit, pendingType);

  useLayoutEffect(() => {
    // Keep the same CSS animation and its elapsed time when speed changes.
    rowRef.current?.getAnimations?.({ subtree: true }).forEach(motion => {
      if ("animationName" in motion && String(motion.animationName).startsWith("hand-dealt-")) motion.playbackRate = rate;
    });
  }, [newlyDealt, rate, rowRef]);

  if (!player) return null;

  return (
    <div
      className={["player-hand-area", player.currentTurn ? "seat-active" : "", winnerGlow ? "seat-winner-glow" : ""].filter(Boolean).join(" ")}
      data-team="your" role="group" aria-label={t("Your hand")}
    >
      <div className="player-hand-decoration" aria-hidden="true" />
      <div ref={rowRef} className="card-fan-row" style={DEAL_HIGHLIGHT_STYLE} data-card-count={visibleCards.length}
        data-layout-count={pendingType === "CHOOSE_TRUMP" ? HAND_CAPACITY : visibleCards.length}>
        {HAND_SPACES.map(index => <div key={`space-${index}`} className="hand-slot hand-slot-empty" aria-hidden="true" />)}
        {visibleCards.map(slot => (
          <div key={slot.key} className={`hand-card-slot${newlyDealt.includes(slot.key) ? " is-newly-dealt" : ""}`} data-card-key={slot.key}>
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
            className={`south-inline-badge south-inline-badge-dealer ${showDealer ? "" : "south-inline-badge-placeholder"}`.trim()}
            aria-hidden={showDealer ? undefined : true}
            title={showDealer ? t("dealer") : undefined}
          >
            {showDealer ? t("dealer") : ""}
          </span>
          <span
            className={`south-inline-badge south-inline-badge-trump ${showTrumpCaller ? "" : "south-inline-badge-placeholder"}`.trim()}
            aria-hidden={showTrumpCaller ? undefined : true}
            title={showTrumpCaller ? t("player.trumpCallerDescription") : undefined}
          >
            {t("player.trumpCaller")}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PlayerHand;
