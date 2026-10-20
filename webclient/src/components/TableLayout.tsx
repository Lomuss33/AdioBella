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
import { fitTableCards, placeTrickCards, type CardLayoutMode } from "../lib/tableCardSizing";
import { getHandColumns, HAND_LAYOUT_REQUEST } from "../lib/handLayout";

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
    let previousMode: CardLayoutMode | undefined;
    const syncHandSize = () => {
      const handStyle = getComputedStyle(handRow);
      const poolStyle = getComputedStyle(pool);
      const arenaStyle = getComputedStyle(arena);
      const bottomStyle = getComputedStyle(bottom);
      const px = (value: string) => parseFloat(value) || 0;
      const ratio = px(poolStyle.getPropertyValue("--playing-card-height-factor")) || 1.42;
      const row = handRow.getBoundingClientRect();
      const field = pool.getBoundingClientRect();
      const table = shell.getBoundingClientRect();
      const arenaBounds = arena.getBoundingClientRect();
      if (!row.width || !field.width) return;
      const handInsets = px(handStyle.paddingTop) + px(handStyle.paddingBottom);
      const handChrome = handArea.getBoundingClientRect().height - row.height;
      const gap = px(poolStyle.getPropertyValue("--trick-card-gap")) || 4;
      // Two pixels of safety around the trick cover fractional CSS rounding.
      const trickReserve = px(poolStyle.top) + px(poolStyle.bottom) + px(poolStyle.paddingTop) + px(poolStyle.paddingBottom)
        + 4;
      const laneBottom = arenaBounds.bottom - px(arenaStyle.paddingBottom) - status.getBoundingClientRect().height;
      const common = {
        handCount: Number(handRow.dataset.layoutCount) || 1,
        handWidth: row.width - px(handStyle.paddingLeft) - px(handStyle.paddingRight),
        trickWidth: field.width - px(poolStyle.paddingLeft) - px(poolStyle.paddingRight) - 4,
        maxCardWidth: px(poolStyle.getPropertyValue("--trick-card-max")) || 120,
        aspectRatio: ratio, handGap: px(handStyle.columnGap), handRowGap: px(handStyle.rowGap), trickGap: gap,
        previous: previousMode
      };
      const layout = fitTableCards(bottomStyle.display === "contents"
        ? { ...common, flow: "beside",
          handHeight: laneBottom - play.getBoundingClientRect().top - handChrome - handInsets,
          trickHeight: table.height - trickReserve }
        : { ...common, flow: "stacked",
          height: laneBottom - table.top - handChrome - handInsets - px(arenaStyle.rowGap)
            - px(bottomStyle.rowGap) - trickReserve });
      previousMode = layout;
      arena.dataset.handRows = String(layout.handRows);
      arena.dataset.trickLayout = layout.trickLayout;
      handRow.style.setProperty("--hand-columns", String(layout.handColumns));
      arena.style.setProperty("--hand-card-max", `${layout.cardWidth}px`);
      // Collapse obsolete ghost tracks now, before measuring the trick or the
      // hand reflow. ResizeObserver then sees an already settled arrangement.
      const columns = getHandColumns(Number(handRow.dataset.cardCount), layout.handColumns);
      handRow.style.setProperty("--hand-grid-columns", String(columns));
      const rows = Math.max(1, Math.ceil((Number(handRow.dataset.cardCount) || 0) / columns));
      handRow.querySelectorAll<HTMLElement>(".hand-slot-empty").forEach((slot, index) => {
        const display = index < rows * columns ? "" : "none";
        if (slot.style.display !== display) slot.style.display = display;
      });
      const space = trickCards.getBoundingClientRect();
      const offsets = placeTrickCards(layout.trickLayout, layout.cardWidth, ratio, gap, space.height - 4);
      const properties = {
        "--table-card-width": layout.cardWidth,
        "--table-trick-offset-x": offsets.offsetX,
        "--table-trick-offset-y": offsets.offsetY,
        "--trick-north-offset-x": offsets.northX,
        "--trick-south-offset-x": offsets.southX
      };
      for (const [property, value] of Object.entries(properties)) {
        const next = `${value}px`;
        if (arena.style.getPropertyValue(property) !== next) arena.style.setProperty(property, next);
      }
    };
    syncHandSize();
    // Settle card-count-driven sizes before the hand captures its reflow targets.
    handRow.addEventListener(HAND_LAYOUT_REQUEST, syncHandSize);
    const scheduleSync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncHandSize);
    };
    const observer = new ResizeObserver(scheduleSync);
    [arena, pool, handRow, handArea, status].forEach(element => observer.observe(element));
    window.addEventListener("resize", scheduleSync);
    return () => {
      observer.disconnect();
      handRow.removeEventListener(HAND_LAYOUT_REQUEST, syncHandSize);
      window.removeEventListener("resize", scheduleSync);
      cancelAnimationFrame(frame);
      delete arena.dataset.handRows;
      delete arena.dataset.trickLayout;
      handRow.style.removeProperty("--hand-columns");
      handRow.style.removeProperty("--hand-grid-columns");
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
