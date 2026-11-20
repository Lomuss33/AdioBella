import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "../i18n";
import type { AnimatedTrickState, GameCompleteSummary, GameSnapshot, GameSettingsDrafts, MatchCompleteSummary, MatchTargetWins, PlayerView, Seat } from "../types";
import type { RoomCommand, RoomView } from "../lib/roomGateway";
import type { DisplayPreferences, Preferences } from "../lib/preferences";
import { PlaybackProvider } from "./PlaybackContext";
import TableLayout from "./TableLayout";
import ActionPanel from "./ActionPanel";
import ConfirmPopup from "./ConfirmPopup";
import GuideBook from "./GuideBook";
import { TableNavigation } from "./TableUtilities";
import TerminalLog from "./TerminalLog";
import CurrentMove from "./CurrentMove";
import { useLanguage } from "../i18n";
import { buildAnimatedTrickTimeline } from "../lib/trickAnimation";
import { PlaybackClock } from "../lib/PlaybackClock";
import { playbackRate } from "../lib/playback";
import { CARD_TIMING } from "../lib/cardAnimationConfig";

const SEAT_RING: Seat[] = ["SOUTH", "WEST", "NORTH", "EAST"];
const nothing = () => {};

export default function RoomGameTable({ room, preferences, onDisplayChange, busy, locked, errorMessage, onAct, onRoomList, onRefresh, retry, onRetry }: {
  room: RoomView;
  preferences: Preferences;
  onDisplayChange: (patch: Partial<DisplayPreferences>) => void;
  busy: boolean;
  locked: boolean;
  errorMessage: string | null;
  onAct: (command: Omit<RoomCommand, "requestId" | "revision">) => void;
  onRoomList: () => void;
  onRefresh: () => void;
  retry: RoomCommand | null;
  onRetry: () => void;
}) {
  useLanguage();
  const { playback } = preferences;
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [hiddenHandIndex, setHiddenHandIndex] = useState<number | null>(null);
  const [displaySnapshot, setDisplaySnapshot] = useState<GameSnapshot>(() => orientSnapshot(room.snapshot, room.yourSeat));
  const [animatedTrick, setAnimatedTrick] = useState<AnimatedTrickState | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationClockRef = useRef<PlaybackClock | null>(null);
  const animationQueueRef = useRef<AnimatedTrickState[]>([]);
  const animationActiveRef = useRef(false);
  const latestRoomSnapshotRef = useRef(room.snapshot);
  const previousRoomRef = useRef({ revision: room.revision, snapshot: room.snapshot });
  const runNextAnimationRef = useRef<() => void>(() => {});
  const finishSelectionRef = useRef<(() => void) | null>(null);
  const selectionPendingRef = useRef(false);
  const requestWasLockedRef = useRef(false);
  const handOriginRef = useRef<{ index: number; rect: { left: number; top: number; width: number; height: number } } | null>(null);
  const [belaIndex, setBelaIndex] = useState<number | null>(null);
  const [confirmExit, setConfirmExit] = useState<"game" | "match" | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const liveSnapshot = orientSnapshot(room.snapshot, room.yourSeat);
  const snapshot = isAnimating ? displaySnapshot : liveSnapshot;
  const playersBySeat = snapshot.players.reduce<Partial<Record<Seat, PlayerView>>>((result, player) => {
    result[player.seat] = player;
    return result;
  }, {});
  const south = playersBySeat.SOUTH;
  const pending = snapshot.pendingAction;
  const myBelaCard = belaIndex === null ? null : south?.hand[belaIndex] ?? null;
  const isTableAction = pending.type === "CHOOSE_TRUMP" || pending.type === "REPORT_MELDS";
  const gameSettings: GameSettingsDrafts = {
    ...preferences.game,
    difficulty: snapshot.score.difficulty,
    matchTargetWins: snapshot.score.matchTargetWins as MatchTargetWins,
    gameLength: snapshot.score.gameTargetPoints === 501 ? "SHORT" : "LONG"
  };
  const playerNames = snapshot.players.reduce((names, player) => ({ ...names, [player.seat]: player.name }), {
    SOUTH: "", NORTH: "", WEST: "", EAST: ""
  });
  const teamNames = { yourTeam: snapshot.score.teamOneName, enemyTeam: snapshot.score.teamTwoName };
  const gameCompleteSummary = buildGameSummary(snapshot, room.events);
  const matchCompleteSummary = buildMatchSummary(snapshot, room.events);
  const handLocked = locked || isAnimating || selectedHandIndex !== null || belaIndex !== null;

  useLayoutEffect(() => {
    const clock = new PlaybackClock(playbackRate(playback.speed));
    animationClockRef.current = clock;
    return () => {
      clock.clear();
      animationClockRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    animationClockRef.current?.setRate(playbackRate(playback.speed));
    if (playback.skipAnimations) finishSelectionRef.current?.();
    if (!playback.skipAnimations || !animationActiveRef.current) return;
    animationClockRef.current?.clear();
    animationQueueRef.current = [];
    animationActiveRef.current = false;
    setAnimatedTrick(null);
    setIsAnimating(false);
    setDisplaySnapshot(orientSnapshot(latestRoomSnapshotRef.current, room.yourSeat));
    setHiddenHandIndex(null);
  }, [playback.speed, playback.skipAnimations, room.yourSeat]);

  useEffect(() => {
    if (locked) requestWasLockedRef.current = true;
    if (requestWasLockedRef.current && !locked && errorMessage && selectedHandIndex !== null) {
      requestWasLockedRef.current = false;
      selectionPendingRef.current = false;
      finishSelectionRef.current = null;
      handOriginRef.current = null;
      setSelectedHandIndex(null);
      setHiddenHandIndex(null);
    }
  }, [locked, errorMessage, selectedHandIndex]);

  useLayoutEffect(() => {
    document.documentElement.dataset.skipAnimations = String(playback.skipAnimations);
    document.documentElement.dataset.playbackSpeed = playback.speed;
    return () => {
      delete document.documentElement.dataset.skipAnimations;
      delete document.documentElement.dataset.playbackSpeed;
    };
  }, [playback.skipAnimations, playback.speed]);

  useLayoutEffect(() => {
    latestRoomSnapshotRef.current = room.snapshot;
    if (room.revision === previousRoomRef.current.revision) return;
    const previous = previousRoomRef.current.snapshot;
    previousRoomRef.current = { revision: room.revision, snapshot: room.snapshot };
    const newEvents = room.events.filter(event => event.sequence > previous.lastEventSequence && event.sequence <= room.snapshot.lastEventSequence);
    const timeline = playback.skipAnimations ? [] : buildAnimatedTrickTimeline(previous, room.snapshot, newEvents)
      .map(segment => orientAnimation(segment, previous, room.yourSeat));
    if (timeline.length === 0) {
      if (!animationActiveRef.current) {
        setDisplaySnapshot(liveSnapshot);
        if (selectionPendingRef.current || selectedHandIndex !== null) {
          selectionPendingRef.current = false;
          requestWasLockedRef.current = false;
          finishSelectionRef.current = null;
          handOriginRef.current = null;
          setSelectedHandIndex(null);
          setHiddenHandIndex(null);
        }
      }
      return;
    }
    const origin = handOriginRef.current;
    if (origin) {
      const card = previous.players.find(player => player.id === room.yourSeat)?.hand[origin.index];
      const localPlay = timeline.flatMap(segment => segment.plays).find(play =>
        play.playerId === room.yourSeat && play.card.suit === card?.suit && play.card.rank === card?.rank
      );
      if (localPlay && card) {
        localPlay.origin = origin.rect;
        setHiddenHandIndex(origin.index);
      }
      selectionPendingRef.current = false;
      requestWasLockedRef.current = false;
      finishSelectionRef.current = null;
      setSelectedHandIndex(null);
      handOriginRef.current = null;
    }
    const wasAnimating = animationActiveRef.current;
    if (!wasAnimating) {
      setDisplaySnapshot(orientSnapshot(previous, room.yourSeat));
      setIsAnimating(true);
      animationActiveRef.current = true;
    }
    animationQueueRef.current.push(...timeline);
    if (!wasAnimating) runNextAnimationRef.current();
  }, [room.revision, room.snapshot, room.events, room.yourSeat, playback.skipAnimations, liveSnapshot]);

  runNextAnimationRef.current = () => {
    const next = animationQueueRef.current.shift();
    if (!next) {
      animationActiveRef.current = false;
      setAnimatedTrick(null);
      setIsAnimating(false);
      setDisplaySnapshot(orientSnapshot(latestRoomSnapshotRef.current, room.yourSeat));
      setHiddenHandIndex(null);
      return;
    }
    const initial = { ...next, visiblePlayCount: Math.min(1, next.plays.length), enteringPlayIndex: null };
    setAnimatedTrick(initial);
    const clock = animationClockRef.current;
    if (!clock) return;
    const schedule = (ms: number, callback: () => void) => clock.schedule(ms, callback);
    for (const [index, step] of next.plays.entries()) {
      if (index > 0) schedule(step.startAtMs, () => setAnimatedTrick(current => current ? {
        ...current, visiblePlayCount: Math.max(current.visiblePlayCount, index + 1), enteringPlayIndex: null
      } : current));
      schedule(step.startAtMs + step.durationMs, () => setAnimatedTrick(current => current ? {
        ...current, pointsVisible: true, pointsDisplay: step.pointsAfterLanding
      } : current));
    }
    const lastPlay = next.plays[next.plays.length - 1];
    if (!next.resolution) {
      schedule(lastPlay.startAtMs + lastPlay.durationMs + CARD_TIMING.unfinishedTrickHoldMs, () => {
        setAnimatedTrick(null);
        runNextAnimationRef.current();
      });
      return;
    }
    const resolution = next.resolution;
    const restTable = () => {
      setAnimatedTrick(current => current ? { ...current, phase: "resting", pointsVisible: false, pointsPulse: false } : current);
      schedule(resolution.restDurationMs, () => {
        setAnimatedTrick(null);
        runNextAnimationRef.current();
      });
    };
    const collectTrick = () => {
      setAnimatedTrick(current => current ? { ...current, phase: "collecting", pointsPulse: false } : current);
      schedule(resolution.collectDurationMs, restTable);
    };
    schedule(resolution.countUpStartMs, () => {
      setAnimatedTrick(current => current ? {
        ...current, phase: "highlight", enteringPlayIndex: null, winnerSeat: resolution.winnerSeat,
        winnerPlayerId: resolution.winnerPlayerId, pointsVisible: true,
        pointsDisplay: resolution.trickPoints, pointsPulse: true
      } : current);
      schedule(Math.min(CARD_TIMING.pointsPulseMs, resolution.highlightDurationMs), () => setAnimatedTrick(current => current ? { ...current, pointsPulse: false } : current));
      schedule(resolution.highlightDurationMs, collectTrick);
    });
  };

  function captureHandOrigin(handIndex: number) {
    const element = document.querySelectorAll<HTMLElement>(".card-fan-row .hand-card-slot")[handIndex]
      ?.querySelector(".playing-card-shell")?.getBoundingClientRect();
    handOriginRef.current = element?.width && element.height ? {
      index: handIndex,
      rect: { left: element.left, top: element.top, width: element.width, height: element.height }
    } : null;
  }

  function submitSelectedCard(handIndex: number, callBela: boolean) {
    setBelaIndex(null);
    selectionPendingRef.current = true;
    const send = () => {
      finishSelectionRef.current = null;
      selectionPendingRef.current = false;
      // Capture after the selection lift, matching singleplayer's card origin.
      captureHandOrigin(handIndex);
      onAct({ action: "CARD", handIndex, callBela });
    };
    if (playback.skipAnimations) send();
    else finishSelectionRef.current = animationClockRef.current?.schedule(CARD_TIMING.selectionMs, send) ?? null;
  }

  const actionPanel = <ActionPanel
    busy={locked}
    pendingAction={pending}
    errorMessage={null}
    playerNames={playerNames}
    teamNames={teamNames}
    yourTeamName={south?.team}
    gameSettings={gameSettings}
    gameCompleteSummary={gameCompleteSummary}
    matchCompleteSummary={matchCompleteSummary}
    onPlayerNameChange={nothing}
    onTeamNameChange={nothing}
    onGameSettingsChange={nothing}
    onStart={() => onAct({ action: "START" })}
    onStartRematch={nothing}
    onOpenSettingsMenu={nothing}
    onChooseTrump={choice => onAct({ action: "TRUMP", choice })}
    onReportMelds={declare => onAct({ action: "MELDS", declare })}
    onAcknowledgeMelds={() => onAct({ action: "ACK" })}
    matchCompleteActions={<button type="button" className="action-button action-button-primary" onClick={onRoomList}>{t("rooms.list")}</button>}
    pendingBelaChoiceCard={myBelaCard}
    onPlayWithBela={() => { if (belaIndex !== null) submitSelectedCard(belaIndex, true); }}
    onPlayWithoutBela={() => { if (belaIndex !== null) submitSelectedCard(belaIndex, false); }}
    onOpenBook={() => setShowGuide(true)}
  />;

  return <PlaybackProvider value={{ settings: playback, onChange: onDisplayChange }}>
    <main className="app-shell game-layout">
      <div className="table-stage">
        <TableLayout
          snapshot={snapshot}
          playersBySeat={playersBySeat}
          animatedTrick={animatedTrick}
          highlightedSeat={animatedTrick && ["highlight", "collecting"].includes(animatedTrick.phase) ? animatedTrick.winnerSeat : null}
          selectedHandIndex={selectedHandIndex}
          hiddenHandIndex={hiddenHandIndex}
          onPlayCard={handIndex => {
            if (selectedHandIndex !== null || locked || isAnimating) return;
            if (pending.belaEligibleCardIndices.includes(handIndex)) {
              setSelectedHandIndex(handIndex);
              setBelaIndex(handIndex);
              return;
            }
            setSelectedHandIndex(handIndex);
            submitSelectedCard(handIndex, false);
          }}
          errorMessage={null}
          pendingType={pending.type}
          handLocked={handLocked}
          canForfeitGame={snapshot.score.gameNumber > 0 && !snapshot.matchComplete && !["START_MATCH", "START_NEXT_GAME"].includes(pending.type) && !locked && !isAnimating}
          canQuitMatch={!snapshot.matchComplete && !locked}
          onForfeitGame={() => setConfirmExit("game")}
          onQuitMatch={() => setConfirmExit("match")}
          onOpenBook={() => setShowGuide(true)}
          shortcuts={<TableNavigation onOpenRooms={onRoomList} refresh={{ onClick: onRefresh, disabled: busy }} />}
          tableActionPanel={isTableAction ? actionPanel : undefined}
        />
        {!isTableAction ? actionPanel : null}
      </div>
      <section className="after-table">
        {errorMessage && <small className="error-line" role="alert">{errorMessage}</small>}
        {retry && <button type="button" className="action-button" onClick={onRetry} disabled={busy}>{t("rooms.retry")}</button>}
        <TerminalLog events={room.events} matchComplete={snapshot.matchComplete} yourTeamName={south?.team}
          currentMove={<CurrentMove snapshot={snapshot} />} />
      </section>
      {confirmExit && <ConfirmPopup kind={confirmExit} onCancel={() => setConfirmExit(null)} onConfirm={() => {
        const action = confirmExit === "game" ? "FORFEIT_GAME" : "FORFEIT";
        setConfirmExit(null);
        onAct({ action });
      }} />}
      {showGuide && <GuideBook initialChapter="welcome" onClose={() => setShowGuide(false)} />}
    </main>
  </PlaybackProvider>;
}

function orientSnapshot(snapshot: GameSnapshot, yourSeatId: string): GameSnapshot {
  const yourSeat = snapshot.players.find(player => player.id === yourSeatId)?.seat ?? "SOUTH";
  const offset = SEAT_RING.indexOf(yourSeat);
  const rotate = (seat: Seat): Seat => SEAT_RING[(SEAT_RING.indexOf(seat) - offset + SEAT_RING.length) % SEAT_RING.length];
  const yourTeam = snapshot.players.find(player => player.seat === yourSeat)?.team;
  const swapTeams = yourTeam === snapshot.score.teamTwoName;
  const score = swapTeams ? {
    ...snapshot.score,
    teamOneName: snapshot.score.teamTwoName,
    teamOneMatchScore: snapshot.score.teamTwoMatchScore,
    teamOneGamePoints: snapshot.score.teamTwoGamePoints,
    teamOneMeldPoints: snapshot.score.teamTwoMeldPoints,
    teamTwoName: snapshot.score.teamOneName,
    teamTwoMatchScore: snapshot.score.teamOneMatchScore,
    teamTwoGamePoints: snapshot.score.teamOneGamePoints,
    teamTwoMeldPoints: snapshot.score.teamOneMeldPoints
  } : snapshot.score;
  return {
    ...snapshot,
    score,
    players: snapshot.players.map(player => ({ ...player, seat: rotate(player.seat) })),
    trick: { ...snapshot.trick, cards: snapshot.trick.cards.map(play => ({ ...play, seat: rotate(play.seat) })) }
  };
}

function orientAnimation(animation: AnimatedTrickState, snapshot: GameSnapshot, yourSeatId: string): AnimatedTrickState {
  const localSeat = snapshot.players.find(player => player.id === yourSeatId)?.seat ?? "SOUTH";
  const offset = SEAT_RING.indexOf(localSeat);
  const rotate = (seat: Seat): Seat => SEAT_RING[(SEAT_RING.indexOf(seat) - offset + SEAT_RING.length) % SEAT_RING.length];
  return {
    ...animation,
    baseCards: animation.baseCards.map(card => ({ ...card, seat: rotate(card.seat) })),
    plays: animation.plays.map(play => ({ ...play, seat: rotate(play.seat) })),
    winnerSeat: animation.winnerSeat ? rotate(animation.winnerSeat) : null,
    resolution: animation.resolution ? { ...animation.resolution, winnerSeat: rotate(animation.resolution.winnerSeat) } : null
  };
}

function buildGameSummary(snapshot: GameSnapshot, events: RoomView["events"]): GameCompleteSummary | null {
  if (snapshot.pendingAction.type !== "START_NEXT_GAME") return null;
  const lastGameWin = [...events].reverse().find(event => event.payload.eventKind === "GAME_WIN");
  const teams = [
    { name: snapshot.score.teamOneName, gamePoints: snapshot.score.teamOneGamePoints, matchWins: snapshot.score.teamOneMatchScore },
    { name: snapshot.score.teamTwoName, gamePoints: snapshot.score.teamTwoGamePoints, matchWins: snapshot.score.teamTwoMatchScore }
  ];
  const winnerName = lastGameWin?.payload.winner;
  const winner = teams.find(team => team.name === winnerName) ?? (teams[0].gamePoints >= teams[1].gamePoints ? teams[0] : teams[1]);
  const loser = teams.find(team => team !== winner)!;
  return {
    gameNumber: snapshot.score.gameNumber,
    winnerName: winner.name,
    loserName: loser.name,
    winnerGamePoints: winner.gamePoints,
    loserGamePoints: loser.gamePoints,
    winnerMatchWins: winner.matchWins,
    loserMatchWins: loser.matchWins,
    matchTargetWins: snapshot.score.matchTargetWins,
    nextGameTargetPoints: snapshot.score.gameTargetPoints,
    byForfeit: lastGameWin?.payload.byForfeit === "true"
  };
}

function buildMatchSummary(snapshot: GameSnapshot, events: RoomView["events"]): MatchCompleteSummary | null {
  if (!snapshot.matchComplete) return null;
  const matchWin = [...events].reverse().find(event => event.payload.eventKind === "MATCH_WIN" || event.payload.eventKind === "MATCH_FORFEIT");
  const lastGame = [...events].reverse().find(event => event.payload.eventKind === "GAME_WIN" || event.payload.eventKind === "GAME_FORFEIT");
  const teams = [
    { name: snapshot.score.teamOneName, gamePoints: snapshot.score.teamOneGamePoints, matchWins: snapshot.score.teamOneMatchScore },
    { name: snapshot.score.teamTwoName, gamePoints: snapshot.score.teamTwoGamePoints, matchWins: snapshot.score.teamTwoMatchScore }
  ];
  const eventWinner = matchWin?.payload.winner ?? lastGame?.payload.winner;
  const winner = teams.find(team => team.name === eventWinner) ?? (teams[0].matchWins >= teams[1].matchWins ? teams[0] : teams[1]);
  const loser = teams.find(team => team !== winner)!;
  const finalGameWinnerPoints = winner.name === teams[0].name ? teams[0].gamePoints : teams[1].gamePoints;
  const finalGameLoserPoints = winner.name === teams[0].name ? teams[1].gamePoints : teams[0].gamePoints;
  return {
    winnerName: winner.name,
    loserName: loser.name,
    winnerMatchWins: winner.matchWins,
    loserMatchWins: loser.matchWins,
    matchTargetWins: snapshot.score.matchTargetWins,
    finalGameWinnerPoints,
    finalGameLoserPoints,
    finalGameByForfeit: lastGame?.payload.byForfeit === "true",
    gameNumber: snapshot.score.gameNumber
  };
}
