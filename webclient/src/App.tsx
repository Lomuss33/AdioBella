import { useEffect, useRef, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import TableLayout from "./components/TableLayout";
import TerminalLog from "./components/TerminalLog";
import { openEventStream } from "./lib/eventStream";
import {
  buildAnimatedTrickTimeline,
  CARD_SELECTION_DELAY_MS,
  HUMAN_HOLD_AFTER_LAND_MS,
  POST_COLLECT_SETTLE_MS,
  POINTS_FINAL_PULSE_MS
} from "./lib/trickAnimation";
import { chooseTrump, createSession, getSession, getSessionEvents, playCard, startMatch, updateLobbySettings } from "./lib/sessionApi";
import type { AnimatedTrickState, GameEvent, GameSnapshot, PlayerNameDrafts, PlayerView, Seat, SessionResponse, TeamNameDrafts } from "./types";

const SESSION_KEY = "belot-session-id";
const SNAPSHOT_REFRESH_DEBOUNCE_MS = 150;

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerNames, setPlayerNames] = useState<PlayerNameDrafts>(emptyPlayerNames());
  const [teamNames, setTeamNames] = useState<TeamNameDrafts>(emptyTeamNames());
  const [difficulty, setDifficulty] = useState("NORMAL");
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [animatedTrick, setAnimatedTrick] = useState<AnimatedTrickState | null>(null);
  const lastSequenceRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const animationTimeoutsRef = useRef<number[]>([]);
  const animatedTrickRef = useRef<AnimatedTrickState | null>(null);
  const deferredSessionRef = useRef<SessionResponse | null>(null);
  const deferredRefreshSessionIdRef = useRef<string | null>(null);
  const pendingAnimationQueueRef = useRef<AnimatedTrickState[]>([]);

  useEffect(() => {
    void bootstrapSession();

    return () => {
      eventSourceRef.current?.close();
      clearScheduledRefresh();
      clearAnimationTimeline();
    };
  }, []);

  useEffect(() => {
    animatedTrickRef.current = animatedTrick;
  }, [animatedTrick]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    eventSourceRef.current?.close();
    const source = openEventStream(sessionId, lastSequenceRef.current, {
      onEvent: (event) => {
        lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);
        setEvents((current) => dedupeEvents([...current, event]).slice(-100));
        scheduleSnapshotRefresh(sessionId);
      },
      onError: () => {
        setErrorMessage("Live event stream disconnected. The browser will retry automatically.");
      }
    });
    eventSourceRef.current = source;

    return () => source.close();
  }, [sessionId]);

  async function bootstrapSession() {
    try {
      const existingSessionId = window.localStorage.getItem(SESSION_KEY);
      if (existingSessionId) {
        try {
          await loadSession(existingSessionId, true);
          setSessionId(existingSessionId);
          return;
        } catch {
          window.localStorage.removeItem(SESSION_KEY);
        }
      }

      const response = await createSession();
      applySession(response);
      await syncEvents(response.sessionId, 0);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create a session.");
    }
  }

  async function loadSession(id: string, includeHistory = false) {
    const response = await getSession(id);
    applySession(response);
    if (includeHistory) {
      await syncEvents(id, 0);
    }
  }

  function scheduleSnapshotRefresh(id: string) {
    if (animatedTrickRef.current) {
      deferredRefreshSessionIdRef.current = id;
      return;
    }

    clearScheduledRefresh();
    refreshTimeoutRef.current = window.setTimeout(() => {
      void loadSession(id).catch(() => {
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
    for (const timeoutId of animationTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    animationTimeoutsRef.current = [];
  }

  function queueAnimation(ms: number, callback: () => void) {
    const timeoutId = window.setTimeout(callback, ms);
    animationTimeoutsRef.current.push(timeoutId);
  }

  async function handleStartMatch() {
    if (!sessionId) {
      return;
    }
    try {
      const previousSequence = lastSequenceRef.current;
      await persistLobbySettingsIfNeeded(sessionId);
      const response = await startMatch(sessionId);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start the match.");
    }
  }

  async function handleChooseTrump(choice: string) {
    if (!sessionId) {
      return;
    }
    try {
      const previousSequence = lastSequenceRef.current;
      const response = await chooseTrump(sessionId, choice);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to choose trump.");
    }
  }

  async function handlePlayCard(handIndex: number) {
    if (!sessionId || !snapshot || selectedHandIndex !== null || animatedTrick !== null) {
      return;
    }

    try {
      const previousSequence = lastSequenceRef.current;
      const currentSnapshot = snapshot;
      const request = playCard(sessionId, handIndex);
      setSelectedHandIndex(handIndex);
      await delay(CARD_SELECTION_DELAY_MS);

      const response = await request;
      const history = await getSessionEvents(sessionId, previousSequence);
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to play the card.");
      setSelectedHandIndex(null);
      clearAnimationTimeline();
      pendingAnimationQueueRef.current = [];
      setAnimatedTrick(null);
    }
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
    clearScheduledRefresh();
    const initialVisiblePlayCount = trickAnimation.plays.length > 0 ? 1 : 0;
    setAnimatedTrick({
      ...trickAnimation,
      visiblePlayCount: initialVisiblePlayCount
    });
    setSelectedHandIndex(null);

    for (const [index, step] of trickAnimation.plays.entries()) {
      if (index > 0) {
        queueAnimation(step.startAtMs, () => {
          setAnimatedTrick((current) =>
            current
              ? {
                  ...current,
                  visiblePlayCount: Math.max(current.visiblePlayCount, index + 1)
                }
              : current
          );
        });
      }

      queueAnimation(step.startAtMs + step.durationMs, () => {
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
      queueAnimation(finishWithoutWinAt + POST_COLLECT_SETTLE_MS, () => {
        setAnimatedTrick(null);
        clearAnimationTimeline();
        runNextAnimationSegment();
      });
      return;
    }

    const resolution = trickAnimation.resolution;
    queueAnimation(resolution.countUpStartMs, () => {
      setAnimatedTrick((current) =>
        current
          ? {
              ...current,
              phase: "highlight",
              winnerSeat: resolution.winnerSeat,
              winnerPlayerId: resolution.winnerPlayerId,
              pointsVisible: true,
              pointsDisplay: resolution.trickPoints,
              pointsPulse: true
            }
          : current
      );
    });

    queueAnimation(resolution.countUpStartMs + POINTS_FINAL_PULSE_MS, () => {
      setAnimatedTrick((current) => (current ? { ...current, pointsPulse: false } : current));
    });

    queueAnimation(resolution.collectStartMs, () => {
      setAnimatedTrick((current) => (current ? { ...current, phase: "collecting" } : current));
    });

    queueAnimation(resolution.collectStartMs + resolution.collectDurationMs + POST_COLLECT_SETTLE_MS, () => {
      setAnimatedTrick(null);
      clearAnimationTimeline();
      runNextAnimationSegment();
    });
  }

  function applySession(response: SessionResponse, options?: { deferSnapshot?: boolean }) {
    const shouldDeferSnapshot = options?.deferSnapshot || animatedTrickRef.current !== null;

    setSessionId(response.sessionId);
    window.localStorage.setItem(SESSION_KEY, response.sessionId);
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
    setPlayerNames((current) => mergePlayerNames(current, response.snapshot.players));
    setTeamNames((current) => mergeTeamNames(current, response.snapshot));
    setDifficulty(response.snapshot.score.difficulty || "NORMAL");
    setErrorMessage(response.snapshot.pendingAction.validationMessage);
  }

  function flushDeferredSession() {
    const refreshSessionId = deferredRefreshSessionIdRef.current;
    deferredRefreshSessionIdRef.current = null;
    const deferredSession = deferredSessionRef.current;

    if (refreshSessionId) {
      void loadSession(refreshSessionId).catch(() => {
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
    const history = await getSessionEvents(id, afterSequence);
    appendHistory(history);
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
      (snapshot.score.difficulty || "NORMAL") === difficulty
    ) {
      return;
    }

    const response = await updateLobbySettings(id, difficulty, playerNames, teamNames);
    applySession(response);
  }

  function handlePlayerNameChange(seat: keyof PlayerNameDrafts, value: string) {
    setPlayerNames((current) => ({ ...current, [seat]: value }));
  }

  function handleDifficultyChange(value: string) {
    setDifficulty(value);
  }

  function handleTeamNameChange(team: keyof TeamNameDrafts, value: string) {
    setTeamNames((current) => ({ ...current, [team]: value }));
  }

  const playersBySeat = indexPlayers(snapshot?.players ?? []);
  const highlightedSeat = animatedTrick && animatedTrick.phase !== "placing" ? animatedTrick.winnerSeat : null;
  const handLocked = selectedHandIndex !== null || animatedTrick !== null;

  return (
    <main className="app-shell">
      <div className="table-stage">
        <TableLayout
          snapshot={snapshot}
          playersBySeat={playersBySeat}
          onPlayCard={handlePlayCard}
          pendingPrompt={snapshot?.pendingAction.prompt}
          errorMessage={errorMessage}
          pendingType={snapshot?.pendingAction.type}
          selectedHandIndex={selectedHandIndex}
          animatedTrick={animatedTrick}
          highlightedSeat={highlightedSeat}
          handLocked={handLocked}
        />
        <ActionPanel
          pendingAction={snapshot?.pendingAction}
          errorMessage={errorMessage}
          playerNames={playerNames}
          teamNames={teamNames}
          difficulty={difficulty}
          onPlayerNameChange={handlePlayerNameChange}
          onTeamNameChange={handleTeamNameChange}
          onDifficultyChange={handleDifficultyChange}
          onStart={handleStartMatch}
          onChooseTrump={handleChooseTrump}
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

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default App;
