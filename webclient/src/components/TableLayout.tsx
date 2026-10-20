import TableUtilities from "./TableUtilities";
import { t } from "../i18n";
import { useLayoutEffect, useRef } from "react";
import type { AnimatedTrickState, GameSnapshot, PlayerView, Seat } from "../types";
import GameDataCard from "./GameDataCard";
import MatchCornerControls from "./MatchCornerControls";
import PlayerHand from "./PlayerHand";
import ScoreBar from "./ScoreBar";
import SeatPanel from "./SeatPanel";
import TrickPile from "./TrickPile";
import { fitSharedCards, fitTrickCards } from "../lib/tableCardSizing";
import { HAND_CAPACITY } from "../lib/handLayout";

interface TableLayoutProps {
  snapshot: GameSnapshot | null;
  playersBySeat: Partial<Record<PlayerView["seat"], PlayerView>>;
  onPlayCard: (handIndex: number) => void;
  errorMessage: string | null;
  pendingType?: string;
  selectedHandIndex?: number | null;
  hiddenHandIndex?: number | null;
  animatedTrick?: AnimatedTrickState | null;
  highlightedSeat?: Seat | null;
  handLocked?: boolean;
  canForfeitGame: boolean;
  canQuitMatch: boolean;
  onForfeitGame: () => void;
  onQuitMatch: () => void;
  onOpenBook: () => void;
}

function TableLayout({ snapshot, playersBySeat, onPlayCard, errorMessage,
  selectedHandIndex, hiddenHandIndex, animatedTrick, highlightedSeat, handLocked,
  canForfeitGame, canQuitMatch, onForfeitGame, onQuitMatch, onOpenBook }: TableLayoutProps) {
  const arenaRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const arena = arenaRef.current;
    const pool = arena?.querySelector<HTMLElement>(".trick-pool");
    const trickCards = pool?.querySelector<HTMLElement>(".trick-cards");
    const shell = pool?.parentElement;
    const handRow = arena?.querySelector<HTMLElement>(".card-fan-row");
    const handArea = handRow?.parentElement;
    const status = arena?.querySelector<HTMLElement>(".arena-status");
    const bottom = arena?.querySelector<HTMLElement>(".arena-bottom");
    const play = arena?.querySelector<HTMLElement>(".arena-play");
    if (!arena || !pool || !trickCards || !shell || !handRow || !handArea || !status || !bottom || !play) return;
    let frame = 0;
    let previousHandWidth = 0;
    const syncHandSize = () => {
      const handStyle = getComputedStyle(handRow);
      const poolStyle = getComputedStyle(pool);
      const arenaStyle = getComputedStyle(arena);
      const bottomStyle = getComputedStyle(bottom);
      const px = (value: string) => parseFloat(value) || 0;
      const columns = Math.max(1, Math.min(HAND_CAPACITY, Math.round(Number(handStyle.getPropertyValue("--hand-columns"))) || HAND_CAPACITY));
      const capacityRows = Math.ceil(HAND_CAPACITY / columns);
      const rows = Math.max(1, Math.ceil((Number(handRow.dataset.cardCount) || 0) / columns));
      const ratio = px(poolStyle.getPropertyValue("--playing-card-height-factor")) || 1.42;
      const span = 1 + 2 * (px(poolStyle.getPropertyValue("--trick-card-separation")) || .62);
      const row = handRow.getBoundingClientRect();
      const field = pool.getBoundingClientRect();
      const table = shell.getBoundingClientRect();
      const arenaBounds = arena.getBoundingClientRect();
      if (!row.width || !field.width) return;
      const handInsets = px(handStyle.paddingTop) + px(handStyle.paddingBottom) + px(handStyle.rowGap) * (rows - 1);
      const capacityInsets = px(handStyle.paddingTop) + px(handStyle.paddingBottom) + px(handStyle.rowGap) * (capacityRows - 1);
      const handChrome = handArea.getBoundingClientRect().height - row.height;
      const handWidthLimit = Math.max(1, (row.width - px(handStyle.paddingLeft) - px(handStyle.paddingRight) - px(handStyle.columnGap) * (columns - 1)) / columns);
      const trickWidthLimit = Math.max(1, Math.min(px(poolStyle.getPropertyValue("--trick-card-max")) || 120,
        (field.width - px(poolStyle.paddingLeft) - px(poolStyle.paddingRight) - 4) / 3.8));
      const trickReserve = px(poolStyle.top) + px(poolStyle.bottom) + px(poolStyle.paddingTop) + px(poolStyle.paddingBottom)
        + px(poolStyle.getPropertyValue("--trick-card-gap")) + 4;
      let handWidth: number;
      if (bottomStyle.display === "contents") {
        // Landscape gives each set its own lane; neither has to shrink to match the other.
        const laneHeight = arenaBounds.bottom - px(arenaStyle.paddingBottom) - status.getBoundingClientRect().height - play.getBoundingClientRect().top;
        handWidth = Math.max(1, Math.floor(Math.min(handWidthLimit,
          (laneHeight - handChrome - capacityInsets) / (ratio * capacityRows)) * 4) / 4);
      } else {
        // This budget is independent of the current card sizes, avoiding resize oscillation.
        const height = arenaBounds.bottom - px(arenaStyle.paddingBottom) - table.top - status.getBoundingClientRect().height
          - handChrome - handInsets - px(arenaStyle.rowGap) - px(bottomStyle.rowGap) - trickReserve;
        // Keep the hand's size independent of trick arrangement and remaining rows.
        const fullHand = fitSharedCards({ height: height + handInsets - capacityInsets, trickWidthLimit,
          handWidthLimit, handRows: capacityRows, aspectRatio: ratio, trickSpan: span });
        handWidth = fullHand.hand;
      }
      if (handWidth !== previousHandWidth) {
        previousHandWidth = handWidth;
        arena.style.setProperty("--hand-card-max", `${handWidth}px`);
      }
      // Hand sizing has settled before measuring this field; absolute trick cards
      // cannot change its dimensions or feed their own size back into the layout.
      const space = trickCards.getBoundingClientRect();
      const layout = fitTrickCards({ width: space.width, height: space.height,
        maxCardWidth: px(poolStyle.getPropertyValue("--trick-card-max")) || 120,
        aspectRatio: ratio, gap: px(poolStyle.getPropertyValue("--trick-card-gap")) || 4,
        allowSpread: window.matchMedia("(max-width: 700px), (max-height: 500px)").matches });
      const properties = {
        "--table-card-width": layout.cardWidth,
        "--table-trick-offset-x": layout.offsetX,
        "--table-trick-offset-y": layout.offsetY,
        "--trick-north-offset-x": layout.northX,
        "--trick-south-offset-x": layout.southX
      };
      for (const [property, value] of Object.entries(properties)) {
        const next = `${value}px`;
        if (arena.style.getPropertyValue(property) !== next) arena.style.setProperty(property, next);
      }
    };
    syncHandSize();
    const scheduleSync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncHandSize);
    };
    const observer = new ResizeObserver(scheduleSync);
    [arena, pool, handRow, handArea, status].forEach(element => observer.observe(element));
    window.addEventListener("resize", scheduleSync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
      cancelAnimationFrame(frame);
      arena.style.removeProperty("--hand-card-max");
      arena.style.removeProperty("--table-card-width");
      arena.style.removeProperty("--table-trick-offset-x");
      arena.style.removeProperty("--table-trick-offset-y");
      arena.style.removeProperty("--trick-north-offset-x");
      arena.style.removeProperty("--trick-south-offset-x");
    };
  }, [Boolean(playersBySeat.SOUTH)]);
  const dealerSeat = snapshot?.players.find((player) => player.dealer)?.seat;
  const declarerSeat = snapshot?.players.find((player) => player.id === snapshot.declarerPlayerId)?.seat;
  const seat = (position: Seat) => <SeatPanel
    player={playersBySeat[position]} seat={position}
    winnerGlow={highlightedSeat === position}
    showDealer={dealerSeat === position} showTrumpCaller={declarerSeat === position}
  />;
  return (
    <section ref={arenaRef} className="table-arena" aria-label={t("Belot table")}>
      <div className="arena-header">
        <GameDataCard snapshot={snapshot} />
      </div>
      <div className="arena-play">
        {seat("NORTH")}
        {seat("WEST")}
        <TrickPile trick={snapshot?.trick ?? { leadPlayerId: null, cards: [] }}
          trumpSuit={snapshot?.trumpSuit ?? null} animatedTrick={animatedTrick} />
        {seat("EAST")}
      </div>
      <div className="arena-bottom">
        <PlayerHand player={playersBySeat.SOUTH} pendingType={snapshot?.pendingAction.type}
          selectedIndex={selectedHandIndex} hiddenIndex={hiddenHandIndex} locked={handLocked}
          winnerGlow={highlightedSeat === "SOUTH"} showDealer={dealerSeat === "SOUTH"}
          showTrumpCaller={declarerSeat === "SOUTH"} onPlayCard={onPlayCard} />
        <div className="arena-status">
          <ScoreBar snapshot={snapshot} errorMessage={errorMessage}
            controls={
              <div className="arena-controls">
                <TableUtilities onOpenBook={onOpenBook} />
                <MatchCornerControls canForfeitGame={canForfeitGame} canQuitMatch={canQuitMatch}
                  onForfeitGame={onForfeitGame} onQuitMatch={onQuitMatch} />
              </div>
            } />
        </div>
      </div>
    </section>
  );
}
export default TableLayout;
