import { useEffect, useRef, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import TableLayout from "./components/TableLayout";
import TerminalLog from "./components/TerminalLog";
import { getGameGateway, shouldPersistSession } from "./lib/gameGateway";
import { HttpError } from "./lib/serverGateway";
import {
  buildAnimatedTrickTimeline,
  CARD_SELECTION_DELAY_MS,
  HUMAN_HOLD_AFTER_LAND_MS,
  PLAY_MOUNT_BUFFER_MS,
  POST_COLLECT_SETTLE_MS,
  POINTS_FINAL_PULSE_MS
} from "./lib/trickAnimation";
import type {
  AnimatedTrickState,
  GameEvent,
  GameSettingsDrafts,
  GameSnapshot,
  MatchTargetWins,
  PlayerNameDrafts,
  PlayerView,
  Seat,
  SessionResponse,
  TableTheme,
  TeamNameDrafts
} from "./types";

const SESSION_KEY = "belot-session-id";
const THEME_KEY = "belot-table-theme";
const SNAPSHOT_REFRESH_DEBOUNCE_MS = 150;
const START_LOADING_MS = 600;
const THEME_META_COLOR: Record<TableTheme, string> = {
  GREEN: "#07120d",
  DARK_BLUE: "#060b16",
  CHERRY_RED: "#150607",
  WOODY_BROWN: "#120b07",
  FINE_BLACK: "#050505"
};

function App() {
  const gateway = getGameGateway();
  const persistSession = shouldPersistSession();
  const bootstrapStartedRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerNames, setPlayerNames] = useState<PlayerNameDrafts>(emptyPlayerNames());
  const [teamNames, setTeamNames] = useState<TeamNameDrafts>(emptyTeamNames());
  const [gameSettings, setGameSettings] = useState<GameSettingsDrafts>(defaultGameSettings);
  const [startScreenPhase, setStartScreenPhase] = useState<"boot-loading" | "ready">("boot-loading");
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [pendingBelaChoiceIndex, setPendingBelaChoiceIndex] = useState<number | null>(null);
  const [hiddenHandIndex, setHiddenHandIndex] = useState<number | null>(null);
  const [animatedTrick, setAnimatedTrick] = useState<AnimatedTrickState | null>(null);
  const lastSequenceRef = useRef(0);
  const subscriptionRef = useRef<{ close(): void } | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const startScreenTimeoutRef = useRef<number | null>(null);
  const animationTimeoutsRef = useRef<number[]>([]);
  const animationRunIdRef = useRef(0);
  const animatedTrickRef = useRef<AnimatedTrickState | null>(null);
  const deferredSessionRef = useRef<SessionResponse | null>(null);
  const deferredRefreshSessionIdRef = useRef<string | null>(null);
  const pendingAnimationQueueRef = useRef<AnimatedTrickState[]>([]);

  useEffect(() => {
    if (!bootstrapStartedRef.current) {
      bootstrapStartedRef.current = true;
      void bootstrapSession();
    }

    return () => {
      subscriptionRef.current?.close();
      clearScheduledRefresh();
      clearAnimationTimeline();
      clearStartScreenTimer();
    };
  }, []);

  useEffect(() => {
    animatedTrickRef.current = animatedTrick;
  }, [animatedTrick]);

  useEffect(() => {
    document.documentElement.setAttribute("data-table-theme", gameSettings.tableTheme);
    window.localStorage.setItem(THEME_KEY, gameSettings.tableTheme);
    syncThemeColorMeta(THEME_META_COLOR[gameSettings.tableTheme]);
  }, [gameSettings.tableTheme]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    subscriptionRef.current?.close();
    const source = gateway.subscribe(sessionId, lastSequenceRef.current, {
      onEvent: (event: GameEvent) => {
        lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);
        setEvents((current) => dedupeEvents([...current, event]).slice(-100));
        scheduleSnapshotRefresh(sessionId);
      },
      onError: () => {
        setErrorMessage("Live event stream disconnected. The browser will retry automatically.");
      }
    });
    subscriptionRef.current = source;

    return () => source.close();
  }, [sessionId]);

  async function bootstrapSession() {
    try {
      if (persistSession) {
        const existingSessionId = window.localStorage.getItem(SESSION_KEY);
        if (existingSessionId) {
          try {
            const restoredSession = await loadSession(existingSessionId, true);
            primeStartScreenPhase(restoredSession.snapshot.pendingAction.type === "START_MATCH");
            setSessionId(existingSessionId);
            return;
          } catch {
            window.localStorage.removeItem(SESSION_KEY);
          }
        }
      }

      const response = await gateway.createSession();
      applyFreshSession(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create a session.");
    }
  }

  async function loadSession(id: string, includeHistory = false) {
    const response = await gateway.getSession(id);
    applySession(response);
    if (includeHistory) {
      await syncEvents(id, 0);
    }
    return response;
  }

  function scheduleSnapshotRefresh(id: string) {
    if (animatedTrickRef.current) {
      deferredRefreshSessionIdRef.current = id;
      return;
    }

    clearScheduledRefresh();
    refreshTimeoutRef.current = window.setTimeout(() => {
      void loadSession(id).catch(async (error) => {
        if (await recoverMissingSession(error)) {
          return;
        }
        setErrorMessage("Unable to refresh the game state.");
      });
      refreshTimeoutRef.current = null;
    }, SNAPSHOT_REFRESH_DEBOUNCE_MS);
  }

  function clearScheduledRefresh() {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }

  function clearAnimationTimeline() {
    animationRunIdRef.current += 1;
    for (const timeoutId of animationTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    animationTimeoutsRef.current = [];
  }

  function clearStartScreenTimer() {
    if (startScreenTimeoutRef.current !== null) {
      window.clearTimeout(startScreenTimeoutRef.current);
      startScreenTimeoutRef.current = null;
    }
  }

  function queueAnimation(runId: number, ms: number, callback: () => void) {
    const timeoutId = window.setTimeout(() => {
      if (animationRunIdRef.current !== runId) {
        return;
      }
      callback();
    }, ms);
    animationTimeoutsRef.current.push(timeoutId);
  }

  async function handleStartMatch() {
    if (!sessionId) {
      return;
    }
    try {
      const previousSequence = lastSequenceRef.current;
      if (snapshot?.pendingAction.type === "START_MATCH") {
        await persistLobbySettingsIfNeeded(sessionId);
      }
      const response = await gateway.startMatch(sessionId);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to start the match.");
    }
  }

  async function handleChooseTrump(choice: string) {
    if (!sessionId) {
      return;
    }
    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.chooseTrump(sessionId, choice);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to choose trump.");
    }
  }

  async function submitCardPlay(handIndex: number, callBela = false) {
    if (!sessionId || !snapshot || (selectedHandIndex !== null && pendingBelaChoiceIndex == null) || animatedTrick !== null) {
      return;
    }

    try {
      const previousSequence = lastSequenceRef.current;
      const currentSnapshot = snapshot;
      const request = gateway.playCard(sessionId, handIndex, callBela);
      setSelectedHandIndex(handIndex);
      setPendingBelaChoiceIndex(null);
      await delay(CARD_SELECTION_DELAY_MS);
      setHiddenHandIndex(handIndex);

      const response = await request;
      const history = await gateway.getSessionEvents(sessionId, previousSequence);
      appendHistory(history);
      const trickAnimations = buildAnimatedTrickTimeline(currentSnapshot, response.snapshot, history);
      if (trickAnimations.length > 0) {
        applySession(response, { deferSnapshot: true });
        startTrickAnimationQueue(trickAnimations);
      } else {
        applySession(response);
        setSelectedHandIndex(null);
      }
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to play the card.");
      setSelectedHandIndex(null);
      setPendingBelaChoiceIndex(null);
      setHiddenHandIndex(null);
      clearAnimationTimeline();
      pendingAnimationQueueRef.current = [];
      setAnimatedTrick(null);
    }
  }

  function handleCardClick(handIndex: number) {
    if (!snapshot || selectedHandIndex !== null || animatedTrick !== null) {
      return;
    }

    if (snapshot.pendingAction.belaEligibleCardIndices.includes(handIndex)) {
      setSelectedHandIndex(handIndex);
      setPendingBelaChoiceIndex(handIndex);
      return;
    }

    void submitCardPlay(handIndex, false);
  }

  async function handleReportMelds(declare: boolean) {
    if (!sessionId) {
      return;
    }

    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.reportMelds(sessionId, declare);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to report melds.");
    }
  }

  async function handleAcknowledgeMelds() {
    if (!sessionId) {
      return;
    }

    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.acknowledgeMelds(sessionId);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to continue after melds.");
    }
  }

  function handlePlayWithBela() {
    if (pendingBelaChoiceIndex == null) {
      return;
    }
    setSelectedHandIndex(null);
    void submitCardPlay(pendingBelaChoiceIndex, true);
  }

  function handlePlayWithoutBela() {
    if (pendingBelaChoiceIndex == null) {
      return;
    }
    setSelectedHandIndex(null);
    void submitCardPlay(pendingBelaChoiceIndex, false);
  }

  function startTrickAnimationQueue(trickAnimations: AnimatedTrickState[]) {
    pendingAnimationQueueRef.current = [...trickAnimations];
    runNextAnimationSegment();
  }

  function runNextAnimationSegment() {
    const nextAnimation = pendingAnimationQueueRef.current.shift();
    if (!nextAnimation) {
      flushDeferredSession();
      return;
    }

    startTrickAnimation(nextAnimation);
  }

  function startTrickAnimation(trickAnimation: AnimatedTrickState) {
    clearAnimationTimeline();
    const runId = animationRunIdRef.current;
    clearScheduledRefresh();
    setAnimatedTrick({
      ...trickAnimation,
      visiblePlayCount: 0,
      enteringPlayIndex: null
    });
    setSelectedHandIndex(null);

    for (const [index, step] of trickAnimation.plays.entries()) {
      queueAnimation(runId, step.startAtMs, () => {
        setAnimatedTrick((current) =>
          current
            ? {
                ...current,
                visiblePlayCount: Math.max(current.visiblePlayCount, index + 1),
                enteringPlayIndex: index
              }
            : current
        );
      });

      queueAnimation(runId, step.startAtMs + PLAY_MOUNT_BUFFER_MS, () => {
        setAnimatedTrick((current) =>
          current && current.enteringPlayIndex === index
            ? {
                ...current,
                enteringPlayIndex: null
              }
            : current
        );
      });

      queueAnimation(runId, step.startAtMs + step.durationMs, () => {
        setAnimatedTrick((current) =>
          current
            ? {
                ...current,
                pointsVisible: true,
                pointsDisplay: step.pointsAfterLanding
              }
            : current
        );
      });
    }

    const lastPlay = trickAnimation.plays[trickAnimation.plays.length - 1];
    const finishWithoutWinAt = lastPlay.startAtMs + lastPlay.durationMs + HUMAN_HOLD_AFTER_LAND_MS;
    if (!trickAnimation.resolution) {
      queueAnimation(runId, finishWithoutWinAt + POST_COLLECT_SETTLE_MS, () => {
        setAnimatedTrick(null);
        clearAnimationTimeline();
        runNextAnimationSegment();
      });
      return;
    }

    const resolution = trickAnimation.resolution;
    queueAnimation(runId, resolution.countUpStartMs, () => {
      setAnimatedTrick((current) =>
        current
          ? {
              ...current,
              phase: "highlight",
              enteringPlayIndex: null,
              winnerSeat: resolution.winnerSeat,
              winnerPlayerId: resolution.winnerPlayerId,
              pointsVisible: true,
              pointsDisplay: resolution.trickPoints,
              pointsPulse: true
            }
          : current
      );
    });

    queueAnimation(runId, resolution.countUpStartMs + POINTS_FINAL_PULSE_MS, () => {
      setAnimatedTrick((current) => (current ? { ...current, pointsPulse: false } : current));
    });

    queueAnimation(runId, resolution.collectStartMs, () => {
      setAnimatedTrick((current) => (current ? { ...current, phase: "collecting" } : current));
    });

    queueAnimation(runId, resolution.collectStartMs + resolution.collectDurationMs + POST_COLLECT_SETTLE_MS, () => {
      setAnimatedTrick(null);
      clearAnimationTimeline();
      runNextAnimationSegment();
    });
  }

  function applySession(response: SessionResponse, options?: { deferSnapshot?: boolean; forceCommit?: boolean }) {
    const shouldDeferSnapshot = !options?.forceCommit && (options?.deferSnapshot || animatedTrickRef.current !== null);

    setSessionId((current) => (current === response.sessionId ? current : response.sessionId));
    if (persistSession) {
      window.localStorage.setItem(SESSION_KEY, response.sessionId);
    }
    lastSequenceRef.current = Math.max(lastSequenceRef.current, response.snapshot.lastEventSequence);

    if (shouldDeferSnapshot) {
      deferredSessionRef.current = response;
      return;
    }

    commitSessionSnapshot(response);
  }

  function commitSessionSnapshot(response: SessionResponse) {
    deferredSessionRef.current = null;
    setSnapshot(response.snapshot);
    setHiddenHandIndex(null);
    setPendingBelaChoiceIndex(null);
    setPlayerNames((current) => mergePlayerNames(current, response.snapshot.players));
    setTeamNames((current) => mergeTeamNames(current, response.snapshot));
    setGameSettings((current) => ({
      ...current,
      difficulty: toDifficulty(response.snapshot.score.difficulty),
      matchTargetWins: toMatchTargetWins(response.snapshot.score.matchTargetWins),
      gameLength: response.snapshot.score.gameTargetPoints <= 501 ? "SHORT" : "LONG"
    }));
    setErrorMessage(response.snapshot.pendingAction.validationMessage);
  }

  function flushDeferredSession() {
    const refreshSessionId = deferredRefreshSessionIdRef.current;
    deferredRefreshSessionIdRef.current = null;
    const deferredSession = deferredSessionRef.current;

    if (refreshSessionId) {
      void gateway
        .getSession(refreshSessionId)
        .then((response) => {
          applySession(response, { forceCommit: true });
        })
        .catch(() => {
        if (deferredSession) {
          commitSessionSnapshot(deferredSession);
          return;
        }
        setErrorMessage("Unable to refresh the game state.");
        });
      return;
    }

    if (deferredSession) {
      commitSessionSnapshot(deferredSession);
    }
  }

  function appendHistory(history: GameEvent[]) {
    if (history.length === 0) {
      return;
    }

    lastSequenceRef.current = Math.max(lastSequenceRef.current, history[history.length - 1].sequence);
    setEvents((current) => dedupeEvents([...current, ...history]).slice(-100));
  }

  async function syncEvents(id: string, afterSequence: number) {
    const history = await gateway.getSessionEvents(id, afterSequence);
    appendHistory(history);
  }

  async function recoverMissingSession(error: unknown) {
    if (!isMissingSessionError(error)) {
      return false;
    }

    subscriptionRef.current?.close();
    clearScheduledRefresh();
    clearAnimationTimeline();
    pendingAnimationQueueRef.current = [];
    deferredSessionRef.current = null;
    deferredRefreshSessionIdRef.current = null;
    animatedTrickRef.current = null;

    setAnimatedTrick(null);
    setSelectedHandIndex(null);
    setPendingBelaChoiceIndex(null);
    setHiddenHandIndex(null);
    setEvents([]);
    setSnapshot(null);
    lastSequenceRef.current = 0;

    if (persistSession) {
      window.localStorage.removeItem(SESSION_KEY);
    }

    const response = await gateway.createSession();
    applyFreshSession(response);
    setErrorMessage("The old session expired. A fresh table has been opened.");
    return true;
  }

  function applyFreshSession(response: SessionResponse) {
    primeStartScreenPhase(true);
    applySession(response);
    void syncEvents(response.sessionId, 0);
  }

  function primeStartScreenPhase(shouldShowLoading: boolean) {
    clearStartScreenTimer();
    if (!shouldShowLoading) {
      setStartScreenPhase("ready");
      return;
    }

    setStartScreenPhase("boot-loading");
    startScreenTimeoutRef.current = window.setTimeout(() => {
      setStartScreenPhase("ready");
      startScreenTimeoutRef.current = null;
    }, START_LOADING_MS);
  }

  async function persistLobbySettingsIfNeeded(id: string) {
    if (!snapshot) {
      return;
    }

    const currentNames = toPlayerNames(snapshot.players);
    const currentTeams = toTeamNames(snapshot);
    if (
      JSON.stringify(currentNames) === JSON.stringify(playerNames) &&
      JSON.stringify(currentTeams) === JSON.stringify(teamNames) &&
      toDifficulty(snapshot.score.difficulty) === gameSettings.difficulty &&
      toMatchTargetWins(snapshot.score.matchTargetWins) === gameSettings.matchTargetWins &&
      (snapshot.score.gameTargetPoints <= 501 ? "SHORT" : "LONG") === gameSettings.gameLength
    ) {
      return;
    }

    const response = await gateway.updateLobbySettings(
      id,
      gameSettings.difficulty,
      playerNames,
      teamNames,
      gameSettings.matchTargetWins,
      gameSettings.gameLength
    );
    applySession(response);
  }

  function handlePlayerNameChange(seat: keyof PlayerNameDrafts, value: string) {
    setPlayerNames((current) => ({ ...current, [seat]: value }));
  }

  function handleTeamNameChange(team: keyof TeamNameDrafts, value: string) {
    setTeamNames((current) => ({ ...current, [team]: value }));
  }

  function handleGameSettingsChange(patch: Partial<GameSettingsDrafts>) {
    setGameSettings((current) => ({ ...current, ...patch }));
  }

  const playersBySeat = indexPlayers(snapshot?.players ?? []);
  const highlightedSeat = animatedTrick && animatedTrick.phase !== "placing" ? animatedTrick.winnerSeat : null;
  const handLocked = selectedHandIndex !== null || animatedTrick !== null || pendingBelaChoiceIndex !== null;
  const southPlayer = playersBySeat.SOUTH;
  const belaChoiceCard =
    pendingBelaChoiceIndex != null && southPlayer?.hand[pendingBelaChoiceIndex]
      ? southPlayer.hand[pendingBelaChoiceIndex]
      : null;

  return (
    <main className="app-shell">
      <div className="table-stage">
        <TableLayout
          snapshot={snapshot}
          playersBySeat={playersBySeat}
          onPlayCard={handleCardClick}
          errorMessage={errorMessage}
          pendingType={snapshot?.pendingAction.type}
          selectedHandIndex={selectedHandIndex}
          hiddenHandIndex={hiddenHandIndex}
          animatedTrick={animatedTrick}
          highlightedSeat={highlightedSeat}
          handLocked={handLocked}
        />
        <ActionPanel
          pendingAction={snapshot?.pendingAction}
          startScreenPhase={startScreenPhase}
          errorMessage={errorMessage}
          playerNames={playerNames}
          teamNames={teamNames}
          gameSettings={gameSettings}
          onPlayerNameChange={handlePlayerNameChange}
          onTeamNameChange={handleTeamNameChange}
          onGameSettingsChange={handleGameSettingsChange}
          gameWinMessage={latestGameWinMessage(events)}
          onStart={handleStartMatch}
          onChooseTrump={handleChooseTrump}
          onReportMelds={handleReportMelds}
          onAcknowledgeMelds={handleAcknowledgeMelds}
          pendingBelaChoiceCard={belaChoiceCard}
          onPlayWithBela={handlePlayWithBela}
          onPlayWithoutBela={handlePlayWithoutBela}
        />
      </div>
      <section className="after-table">
        <TerminalLog events={events} matchComplete={snapshot?.matchComplete} />
      </section>
    </main>
  );
}

function indexPlayers(players: PlayerView[]) {
  return players.reduce<Partial<Record<PlayerView["seat"], PlayerView>>>((result, player) => {
    result[player.seat] = player;
    return result;
  }, {});
}

function dedupeEvents(events: GameEvent[]) {
  const bySequence = new Map<number, GameEvent>();
  for (const event of events) {
    if (!bySequence.has(event.sequence)) {
      bySequence.set(event.sequence, event);
    }
  }

  return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
}

function emptyPlayerNames(): PlayerNameDrafts {
  return {
    SOUTH: "",
    WEST: "",
    NORTH: "",
    EAST: ""
  };
}

function toPlayerNames(players: PlayerView[]): PlayerNameDrafts {
  const names = emptyPlayerNames();
  for (const player of players) {
    names[player.seat] = player.name;
  }
  return names;
}

function emptyTeamNames(): TeamNameDrafts {
  return {
    yourTeam: "",
    enemyTeam: ""
  };
}

function defaultGameSettings(): GameSettingsDrafts {
  const storedTheme = typeof window === "undefined" ? null : window.localStorage.getItem(THEME_KEY);
  return {
    difficulty: "NORMAL",
    matchTargetWins: 3,
    gameLength: "LONG",
    tableTheme: isTableTheme(storedTheme) ? storedTheme : "GREEN"
  };
}

function toTeamNames(snapshot: GameSnapshot): TeamNameDrafts {
  return {
    yourTeam: snapshot.score.teamOneName,
    enemyTeam: snapshot.score.teamTwoName
  };
}

function mergePlayerNames(current: PlayerNameDrafts, players: PlayerView[]): PlayerNameDrafts {
  const incoming = toPlayerNames(players);
  return {
    SOUTH: current.SOUTH || incoming.SOUTH,
    WEST: current.WEST || incoming.WEST,
    NORTH: current.NORTH || incoming.NORTH,
    EAST: current.EAST || incoming.EAST
  };
}

function mergeTeamNames(current: TeamNameDrafts, snapshot: GameSnapshot): TeamNameDrafts {
  const incoming = toTeamNames(snapshot);
  return {
    yourTeam: current.yourTeam || incoming.yourTeam,
    enemyTeam: current.enemyTeam || incoming.enemyTeam
  };
}

function toDifficulty(value: string | null | undefined): GameSettingsDrafts["difficulty"] {
  return value === "EASY" || value === "HARD" ? value : "NORMAL";
}

function toMatchTargetWins(value: number | null | undefined): MatchTargetWins {
  return value === 1 || value === 5 ? value : 3;
}

function isTableTheme(value: string | null): value is TableTheme {
  return value === "GREEN" || value === "DARK_BLUE" || value === "CHERRY_RED" || value === "WOODY_BROWN" || value === "FINE_BLACK";
}

function latestGameWinMessage(events: GameEvent[]) {
  const latest = [...events].reverse().find((event) => event.payload.eventKind === "GAME_WIN");
  return latest?.message ?? null;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function syncThemeColorMeta(color: string) {
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function isMissingSessionError(error: unknown) {
  if (error instanceof HttpError) {
    return error.status === 404;
  }

  if (error instanceof Error) {
    return /session not found/i.test(error.message);
  }

  return false;
}

export default App;
