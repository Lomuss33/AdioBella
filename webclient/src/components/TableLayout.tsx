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
    const syncHandSize = () => {
      // Read the actual fitted table card, including short-height constraints.
      const width = Math.floor(guide.getBoundingClientRect().width * .82);
      if (width > 0 && width !== previousWidth) {
        previousWidth = width;
        arena.style.setProperty("--hand-card-max", `${width}px`);
      }
    };
    syncHandSize();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncHandSize);
    });
    observer.observe(guide);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      arena.style.removeProperty("--hand-card-max");
    };
  }, []);
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
