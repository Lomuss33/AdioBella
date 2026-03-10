import type { AnimatedTrickState, GameSnapshot, PlayerView, Seat } from "../types";
import GameDataCard from "./GameDataCard";
import MatchDataCard from "./MatchDataCard";
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
}

function TableLayout({
  snapshot,
  playersBySeat,
  onPlayCard,
  errorMessage,
  pendingType,
  selectedHandIndex,
  hiddenHandIndex,
  animatedTrick,
  highlightedSeat,
  handLocked
}: TableLayoutProps) {
  const dealerSeat = (Object.values(playersBySeat).find((player) => player?.dealer)?.seat ?? null) as PlayerView["seat"] | null;
  const declarerSeat = (snapshot?.players.find((player) => player.id === snapshot.declarerPlayerId)?.seat ?? null) as PlayerView["seat"] | null;

  return (
    <section className={`table-panel ${pendingType === "CHOOSE_TRUMP" ? "table-panel-trump-open" : ""}`.trim()}>
      <div className="table-surface">
        <div className="table-top-row">
          <MatchDataCard snapshot={snapshot} />
          <SeatPanel
            player={playersBySeat.NORTH}
            winnerGlow={highlightedSeat === "NORTH"}
            showDealer={dealerSeat === "NORTH"}
            showTrumpCaller={declarerSeat === "NORTH"}
          />
          <GameDataCard snapshot={snapshot} />
        </div>
        <div className="compact-mobile-player-row compact-mobile-player-row-enemy">
          <SeatPanel
            player={playersBySeat.WEST}
            winnerGlow={highlightedSeat === "WEST"}
            showDealer={dealerSeat === "WEST"}
            showTrumpCaller={declarerSeat === "WEST"}
          />
          <SeatPanel
            player={playersBySeat.EAST}
            winnerGlow={highlightedSeat === "EAST"}
            showDealer={dealerSeat === "EAST"}
            showTrumpCaller={declarerSeat === "EAST"}
          />
        </div>
        <div className="table-middle-row">
          <SeatPanel
            player={playersBySeat.WEST}
            winnerGlow={highlightedSeat === "WEST"}
            showDealer={dealerSeat === "WEST"}
            showTrumpCaller={declarerSeat === "WEST"}
          />
          <TrickPile
            trick={snapshot?.trick ?? { leadPlayerId: null, cards: [] }}
            trumpSuit={snapshot?.trumpSuit ?? null}
            animatedTrick={animatedTrick}
          />
          <SeatPanel
            player={playersBySeat.EAST}
            winnerGlow={highlightedSeat === "EAST"}
            showDealer={dealerSeat === "EAST"}
            showTrumpCaller={declarerSeat === "EAST"}
          />
        </div>
        <div className="compact-mobile-player-row compact-mobile-player-row-team">
          <SeatPanel
            player={playersBySeat.NORTH}
            winnerGlow={highlightedSeat === "NORTH"}
            showDealer={dealerSeat === "NORTH"}
            showTrumpCaller={declarerSeat === "NORTH"}
          />
          <SeatPanel
            player={playersBySeat.SOUTH}
            winnerGlow={highlightedSeat === "SOUTH"}
            showDealer={dealerSeat === "SOUTH"}
            showTrumpCaller={declarerSeat === "SOUTH"}
          />
        </div>
        <div className="table-bottom-row">
          <ScoreBar snapshot={snapshot} animatedTrick={animatedTrick} errorMessage={errorMessage} />
          <PlayerHand
            player={playersBySeat.SOUTH}
            pendingType={snapshot?.pendingAction.type}
            selectedIndex={selectedHandIndex}
            hiddenIndex={hiddenHandIndex}
            locked={handLocked}
            winnerGlow={highlightedSeat === "SOUTH"}
            showDealer={dealerSeat === "SOUTH"}
            showTrumpCaller={declarerSeat === "SOUTH"}
            onPlayCard={onPlayCard}
          />
        </div>
      </div>
    </section>
  );
}

export default TableLayout;
