import { useLayoutEffect, useRef } from "react";
import type { AnimatedTrickState, GameSnapshot, PlayerView, Seat } from "../types";
import GameDataCard from "./GameDataCard";
import MatchDataCard from "./MatchDataCard";
import MatchCornerControls from "./MatchCornerControls";
import PlayerHand from "./PlayerHand";
import ScoreBar from "./ScoreBar";
import SeatPanel from "./SeatPanel";
import TrickPile from "./TrickPile";

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
}

function TableLayout({ snapshot, playersBySeat, onPlayCard, errorMessage,
  selectedHandIndex, hiddenHandIndex, animatedTrick, highlightedSeat, handLocked,
  canForfeitGame, canQuitMatch, onForfeitGame, onQuitMatch }: TableLayoutProps) {
  const arenaRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const arena = arenaRef.current;
    const guide = arena?.querySelector<HTMLElement>(".trick-size-guide");
    if (!arena || !guide) return;
    let frame = 0;
    let previousWidth = 0;
    let previousLimit = 0;
    const handRow = arena.querySelector<HTMLElement>(".card-fan-row");
    const syncHandSize = () => {
      // Fit both sets to the hand's available width, with only a 5% difference.
      if (handRow) {
        const style = getComputedStyle(handRow);
        const columns = Number(style.getPropertyValue("--hand-columns")) || 8;
        const gap = parseFloat(style.columnGap) || 0;
        const inset = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        const available = (handRow.clientWidth - inset - gap * (columns - 1)) / columns;
        const limit = Math.max(32, Math.floor(available / .95));
        if (limit !== previousLimit) {
          previousLimit = limit;
          arena.style.setProperty("--trick-hand-limit", `${limit}px`);
        }
      }
      const width = Math.floor(guide.getBoundingClientRect().width * .95 * 4) / 4;
      if (width > 0 && width !== previousWidth) {
        previousWidth = width;
        arena.style.setProperty("--hand-card-max", `${width}px`);
      }
    };
    syncHandSize();
    const scheduleSync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncHandSize);
    };
    const observer = new ResizeObserver(scheduleSync);
    observer.observe(guide);
    if (handRow) observer.observe(handRow);
    window.addEventListener("resize", scheduleSync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
      cancelAnimationFrame(frame);
      arena.style.removeProperty("--hand-card-max");
      arena.style.removeProperty("--trick-hand-limit");
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
    <section ref={arenaRef} className="table-arena" aria-label="Belot table">
      <div className="arena-header">
        <GameDataCard snapshot={snapshot} />
        <MatchDataCard snapshot={snapshot} />
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
          <ScoreBar snapshot={snapshot} animatedTrick={animatedTrick} errorMessage={errorMessage} />
          <MatchCornerControls canForfeitGame={canForfeitGame} canQuitMatch={canQuitMatch}
            onForfeitGame={onForfeitGame} onQuitMatch={onQuitMatch} />
        </div>
      </div>
    </section>
  );
}
export default TableLayout;
