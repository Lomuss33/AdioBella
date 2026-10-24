import { accentVariables, tableVariables, tablePalettes, TABLE_THEMES } from "./lib/appearanceTheme";
import GuideBook from "./components/GuideBook";
import { loadPreferences, savePreferences, readStorage, writeStorage, removeStorage, type VisualSettings } from "./lib/preferences";
import { errorCode } from "./i18n/presentation";
import { useLanguage } from "./i18n";
import { resolveNames } from "./i18n/defaultNames";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import ConfirmPopup from "./components/ConfirmPopup";
import SessionStatus from "./components/SessionStatus";
import TableLayout from "./components/TableLayout";
import { CardStyleProvider } from "./components/CardStyleContext";
import { preloadDeckArtwork, usePreparedCardStyle } from "./lib/cardArtwork";
import TerminalLog from "./components/TerminalLog";
import CurrentMove from "./components/CurrentMove";
import { getGameGateway, shouldPersistSession } from "./lib/gameGateway";
import { HttpError } from "./lib/serverGateway";
import { buildAnimatedTrickTimeline } from "./lib/trickAnimation";
import { CARD_TIMING } from "./lib/cardAnimationConfig";
import { PlaybackClock } from "./lib/PlaybackClock";
import { playbackRate, type PlaybackSettings } from "./lib/playback";
import { PlaybackProvider } from "./components/PlaybackContext";
import type {
  AnimatedTrickState,
  GameEvent,
  GameCompleteSummary,
  GameSettingsDrafts,
  GameSnapshot,
  MatchCompleteSummary,
  MatchTargetWins,
  PlayerNameDrafts,
  PlayerView,
  Seat,
  SessionResponse,
  TableTheme,
  TeamNameDrafts,
  TrumpChoice
} from "./types";

const SESSION_KEY = "belot-session-id";
const THEME_KEY = "belot-table-theme";
const SNAPSHOT_REFRESH_DEBOUNCE_MS = 150;

function App() {
  const { locale } = useLanguage();
  const [initialPreferences] = useState(loadPreferences);
  const [showBook, setShowBook] = useState<"welcome" | "rules" | null>(null);
  const [visual, setVisual] = useState<VisualSettings>(initialPreferences.visual);
  const paintedCardStyle = usePreparedCardStyle(visual.cardStyle);
  const [playback, setPlayback] = useState<PlaybackSettings>(initialPreferences.playback);
  const playbackRef = useRef(playback);
  const [animationClock] = useState(() => new PlaybackClock(playbackRate(initialPreferences.playback.speed)));
  const [selectionClock] = useState(() => new PlaybackClock(playbackRate(initialPreferences.playback.speed)));
  const finishSelectionRef = useRef<(() => void) | null>(null);
  const [confirmExit, setConfirmExit] = useState<"game" | "match" | null>(null);
  const gateway = getGameGateway();
  const persistSession = shouldPersistSession();
  const bootstrapStartedRef = useRef(false);
  const bootstrapPendingRef = useRef(false);
  const [connecting, setConnecting] = useState(true);
  const commandPendingRef = useRef(false);
  const [commandPending, setCommandPending] = useState(false);
  const previousLocaleRef = useRef(locale);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerNameDrafts, setPlayerNames] = useState<PlayerNameDrafts>(initialPreferences.players);
  const [teamNameDrafts, setTeamNames] = useState<TeamNameDrafts>(initialPreferences.teams);
  const { players: playerNames, teams: teamNames } = resolveNames(locale, playerNameDrafts, teamNameDrafts);
  const [gameSettings, setGameSettings] = useState<GameSettingsDrafts>(initialPreferences.game);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [pendingBelaChoiceIndex, setPendingBelaChoiceIndex] = useState<number | null>(null);
  const [hiddenHandIndex, setHiddenHandIndex] = useState<number | null>(null);
  const [animatedTrick, setAnimatedTrick] = useState<AnimatedTrickState | null>(null);
  const [sessionResetting, setSessionResetting] = useState(false);
  const lastSequenceRef = useRef(0);
  const subscriptionRef = useRef<{ close(): void } | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const animationRunIdRef = useRef(0);
  const animatedTrickRef = useRef<AnimatedTrickState | null>(null);
  const deferredSessionRef = useRef<SessionResponse | null>(null);
  const deferredRefreshSessionIdRef = useRef<string | null>(null);
  const pendingAnimationQueueRef = useRef<AnimatedTrickState[]>([]);
  const pendingPlayRef = useRef(false);
  const committedSessionRef = useRef<SessionResponse | null>(null);
  const sessionGenerationRef = useRef(0);

  useEffect(() => {
    if (!bootstrapStartedRef.current) {
      bootstrapStartedRef.current = true;
      void bootstrapSession();
    }

    return () => {
      subscriptionRef.current?.close();
      clearScheduledRefresh();
      clearAnimationTimeline();
    };
  }, []);

  useEffect(() => {
    animatedTrickRef.current = animatedTrick;
  }, [animatedTrick]);

  useEffect(() => {
    savePreferences({ version: 1, namesVersion: initialPreferences.namesVersion, game: gameSettings, players: playerNameDrafts, teams: teamNameDrafts, visual, playback });
  }, [gameSettings, playerNameDrafts, teamNameDrafts, visual, playback]);
  useLayoutEffect(() => {
    document.documentElement.dataset.skipAnimations = String(playback.skipAnimations);
    document.documentElement.dataset.playbackSpeed = playback.speed;
    return () => {
      delete document.documentElement.dataset.skipAnimations;
      delete document.documentElement.dataset.playbackSpeed;
    };
  }, [playback]);
  useEffect(() => {
    if (previousLocaleRef.current === locale) return;
    previousLocaleRef.current = locale;
    if (sessionId && snapshot?.pendingAction.type === "START_MATCH") {
      void persistLobbySettingsIfNeeded(sessionId).catch(error => setErrorMessage(errorCode(error)));
    }
  }, [locale]);
  useLayoutEffect(() => {
    document.documentElement.dataset.cardStyle = paintedCardStyle;
    document.documentElement.dataset.gameAccent = visual.accent;
    document.documentElement.dataset.tableTheme = gameSettings.tableTheme;
    for (const [key, value] of Object.entries({ ...tableVariables(gameSettings.tableTheme), ...accentVariables(visual.accent) })) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [visual, paintedCardStyle, gameSettings.tableTheme]);
  useEffect(() => {
    writeStorage(THEME_KEY, gameSettings.tableTheme);
    syncThemeColorMeta(tablePalettes[gameSettings.tableTheme].backdrop);
  }, [gameSettings.tableTheme]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    subscriptionRef.current?.close();
    let source: { close(): void };
    try {
      source = gateway.subscribe(sessionId, lastSequenceRef.current, {
      onEvent: (event: GameEvent) => {
        lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);
        setEvents((current) => dedupeEvents([...current, event]).slice(-100));
        scheduleSnapshotRefresh(sessionId);
      },
      onOpen: () => {
        setErrorMessage((current) => current === "error.stream" ? null : current);
      },
      onError: () => {
        setErrorMessage("error.stream");
      }
      });
    } catch (error) {
      // A browser-runtime restart can invalidate a session before subscribing.
      // Recover through the same path as a missing HTTP session, never a render crash.
      void recoverMissingSession(error).then(recovered => {
        if (!recovered) setErrorMessage("error.stream");
      });
      return;
    }
    subscriptionRef.current = source;

    return () => source.close();
  }, [sessionId]);

  async function bootstrapSession() {
    if (bootstrapPendingRef.current) return;
    bootstrapPendingRef.current = true;
    setConnecting(true);
    setErrorMessage(null);
    try {
      // Fetch the session concurrently, but never paint a saved non-original
      // deck's first hand before its complete artwork is ready.
      const artworkReady = preloadDeckArtwork(initialPreferences.visual.cardStyle);
      if (persistSession) {
        const existingSessionId = readStorage(SESSION_KEY);
        if (existingSessionId) {
          try {
            const restoredSession = await loadSession(existingSessionId, true, artworkReady);
            setSessionId(existingSessionId);
            return;
          } catch (error) {
            // A transient failure must never replace a recoverable match.
            if (!isMissingSessionError(error)) throw error;
            removeStorage(SESSION_KEY);
          }
        }
      }

      const response = await createConfiguredSession();
      await artworkReady;
      applyFreshSession(response);
    } catch (error) {
      setErrorMessage(errorCode(error));
    } finally {
      bootstrapPendingRef.current = false;
      setConnecting(false);
    }
  }

  async function loadSession(id: string, includeHistory = false, artworkReady?: Promise<void>) {
    const generation = sessionGenerationRef.current;
    const response = await gateway.getSession(id);
    if (artworkReady) await artworkReady;
    if (generation !== sessionGenerationRef.current) return response;
    applySession(response);
    if (includeHistory) {
      try { await syncEvents(id, 0); }
      catch { if (generation === sessionGenerationRef.current) setErrorMessage("error.refresh"); }
    }
    return response;
  }

  function scheduleSnapshotRefresh(id: string) {
    if (animatedTrickRef.current || pendingPlayRef.current) {
      deferredRefreshSessionIdRef.current = id;
      return;
    }

    clearScheduledRefresh();
    refreshTimeoutRef.current = window.setTimeout(() => {
      void loadSession(id).catch(async (error) => {
        if (await recoverMissingSession(error)) {
          return;
        }
        setErrorMessage("error.refresh");
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
    animationClock.clear();
    finishSelectionRef.current?.();
    selectionClock.clear();
  }

  function queueAnimation(runId: number, ms: number, callback: () => void) {
    animationClock.schedule(ms, () => {
      if (animationRunIdRef.current !== runId) {
        return;
      }
      callback();
    });
  }

  function handlePlaybackChange(patch: Partial<PlaybackSettings>) {
    const next = { ...playbackRef.current, ...patch };
    playbackRef.current = next;
    setPlayback(next);
    animationClock.setRate(playbackRate(next.speed));
    selectionClock.setRate(playbackRate(next.speed));
    if (next.skipAnimations) finishSelectionRef.current?.();
    if (next.skipAnimations && animatedTrickRef.current) {
      clearAnimationTimeline();
      pendingAnimationQueueRef.current = [];
      flushDeferredSession();
    }
  }

  function waitForCardSelection() {
    if (playbackRef.current.skipAnimations) return Promise.resolve();
    return new Promise<void>(resolve => {
      finishSelectionRef.current = selectionClock.schedule(CARD_TIMING.selectionMs, () => {
        finishSelectionRef.current = null;
        resolve();
      });
    });
  }

  function beginCommand() {
    if (commandPendingRef.current || pendingPlayRef.current || animatedTrickRef.current) return false;
    commandPendingRef.current = true;
    setCommandPending(true);
    return true;
  }

  function endCommand() {
    commandPendingRef.current = false;
    setCommandPending(false);
  }

  async function handleStartMatch(openGuide = false) {
    if (!sessionId) {
      return;
    }
    if (!beginCommand()) return;
    try {
      // Starting immediately after a deck change must not deal its fallback faces.
      await preloadDeckArtwork(visual.cardStyle);
      const previousSequence = lastSequenceRef.current;
      if (snapshot?.pendingAction.type === "START_MATCH") {
        await persistLobbySettingsIfNeeded(sessionId);
      }
      const response = await gateway.startMatch(sessionId);
      applySession(response);
      if (openGuide) setShowBook("rules");
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function handleChooseTrump(choice: TrumpChoice) {
    if (!sessionId) {
      return;
    }
    if (!beginCommand()) return;
    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.chooseTrump(sessionId, choice);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function submitCardPlay(handIndex: number, callBela = false) {
    if (!sessionId || !snapshot || commandPendingRef.current || pendingPlayRef.current || (selectedHandIndex !== null && pendingBelaChoiceIndex == null) || animatedTrick !== null) {
      return;
    }

    pendingPlayRef.current = true;
    const generation = sessionGenerationRef.current;
    clearScheduledRefresh();
    try {
      const previousSequence = lastSequenceRef.current;
      const currentSnapshot = snapshot;
      setSelectedHandIndex(handIndex);
      setPendingBelaChoiceIndex(null);
      const [response] = await Promise.all([
        gateway.playCard(sessionId, handIndex, callBela),
        waitForCardSelection()
      ]);
      if (generation !== sessionGenerationRef.current) return;
      // An accepted play remains authoritative even if its optional history fetch fails.
      let history: GameEvent[];
      try { history = await gateway.getSessionEvents(sessionId, previousSequence); }
      catch {
        if (generation !== sessionGenerationRef.current) return;
        applySession(response, { forceCommit: true });
        setSelectedHandIndex(null);
        return;
      }
      if (generation !== sessionGenerationRef.current) return;
      appendHistory(history);
      const trickAnimations = playbackRef.current.skipAnimations ? [] : buildAnimatedTrickTimeline(currentSnapshot, response.snapshot, history);
      if (trickAnimations.length > 0) {
        const origin = document.querySelectorAll<HTMLElement>(".card-fan-row .hand-card-slot")[handIndex]
          ?.querySelector(".playing-card-shell")?.getBoundingClientRect();
        const human = currentSnapshot.players.find(player => player.seat === "SOUTH");
        const played = human?.hand[handIndex];
        if (origin?.width && origin.height && played) {
          const step = trickAnimations.flatMap(segment => segment.plays).find(play => play.seat === "SOUTH"
            && play.card.rank === played.rank && play.card.suit === played.suit);
          if (step) step.origin = { left: origin.left, top: origin.top, width: origin.width, height: origin.height };
        }
        applySession(response, { deferSnapshot: true });
        setHiddenHandIndex(handIndex);
        startTrickAnimationQueue(trickAnimations);
      } else {
        applySession(response, { forceCommit: true });
        setSelectedHandIndex(null);
      }
    } catch (error) {
      if (generation !== sessionGenerationRef.current) return;
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(errorCode(error));
      setSelectedHandIndex(null);
      setPendingBelaChoiceIndex(null);
      setHiddenHandIndex(null);
      clearAnimationTimeline();
      pendingAnimationQueueRef.current = [];
      animatedTrickRef.current = null;
      setAnimatedTrick(null);
    } finally {
      if (generation === sessionGenerationRef.current) {
        pendingPlayRef.current = false;
        finishSelectionRef.current?.();
      }
    }
  }

  function handleCardClick(handIndex: number) {
    if (!snapshot || commandPendingRef.current || selectedHandIndex !== null || animatedTrick !== null) {
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

    if (!beginCommand()) return;
    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.reportMelds(sessionId, declare);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function handleAcknowledgeMelds() {
    if (!sessionId) {
      return;
    }

    if (!beginCommand()) return;
    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.acknowledgeMelds(sessionId);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function handleForfeitGame() {
    if (!sessionId || animatedTrick !== null) {
      return;
    }

    if (!beginCommand()) return;
    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.forfeitGame(sessionId);
      clearAnimationTimeline();
      pendingAnimationQueueRef.current = [];
      animatedTrickRef.current = null;
      setAnimatedTrick(null);
      setSelectedHandIndex(null);
      setPendingBelaChoiceIndex(null);
      setHiddenHandIndex(null);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) {
        return;
      }
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function handleQuitMatch() {
    if (!sessionId || animatedTrick !== null) {
      return;
    }

    if (!beginCommand()) return;
    try {
      const previousSequence = lastSequenceRef.current;
      const response = await gateway.forfeitMatch(sessionId);
      clearAnimationTimeline();
      pendingAnimationQueueRef.current = [];
      animatedTrickRef.current = null;
      setAnimatedTrick(null);
      setSelectedHandIndex(null);
      setPendingBelaChoiceIndex(null);
      setHiddenHandIndex(null);
      applySession(response);
      await syncEvents(sessionId, previousSequence);
    } catch (error) {
      if (await recoverMissingSession(error)) return;
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function handleStartRematch() {
    if (animatedTrick !== null) {
      return;
    }

    if (!beginCommand()) return;
    try {
      await openFreshSessionWithCurrentSetup(true);
    } catch (error) {
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function handleOpenSettingsMenu() {
    if (animatedTrick !== null) {
      return;
    }

    if (!beginCommand()) return;
    try {
      await openFreshSessionWithCurrentSetup(false);
    } catch (error) {
      setErrorMessage(errorCode(error));
    } finally {
      endCommand();
    }
  }

  async function openFreshSessionWithCurrentSetup(autoStart: boolean) {
    setSessionResetting(true);
    try {
      resetClientSessionState();
      const createdSession = await gateway.createSession();
      const configuredSession = await gateway.updateLobbySettings(
        createdSession.sessionId,
        gameSettings.difficulty,
        playerNames,
        teamNames,
        gameSettings.matchTargetWins,
        gameSettings.gameLength
      );

      if (autoStart) {
        const startedSession = await gateway.startMatch(createdSession.sessionId);
        applySession(startedSession);
        await syncEvents(createdSession.sessionId, 0);
        setErrorMessage(null);
        return;
      }

      applySession(configuredSession);
      await syncEvents(createdSession.sessionId, 0);
      setErrorMessage(null);
    } finally {
      setSessionResetting(false);
    }
  }

  function resetClientSessionState() {
    sessionGenerationRef.current += 1;
    committedSessionRef.current = null;
    pendingPlayRef.current = false;
    subscriptionRef.current?.close();
    clearScheduledRefresh();
    clearAnimationTimeline();
    pendingAnimationQueueRef.current = [];
    deferredSessionRef.current = null;
    deferredRefreshSessionIdRef.current = null;
    animatedTrickRef.current = null;
    lastSequenceRef.current = 0;

    setAnimatedTrick(null);
    setSelectedHandIndex(null);
    setPendingBelaChoiceIndex(null);
    setHiddenHandIndex(null);
    setEvents([]);
    setSnapshot(null);
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
      clearAnimationTimeline();
      flushDeferredSession();
      return;
    }

    startTrickAnimation(nextAnimation);
  }

  function startTrickAnimation(trickAnimation: AnimatedTrickState) {
    clearAnimationTimeline();
    const runId = animationRunIdRef.current;
    clearScheduledRefresh();
    const initial = {
      ...trickAnimation,
      visiblePlayCount: Math.min(1, trickAnimation.plays.length),
      enteringPlayIndex: null
    };
    animatedTrickRef.current = initial;
    setAnimatedTrick(initial);
    setSelectedHandIndex(null);

    for (const [index, step] of trickAnimation.plays.entries()) {
      if (index > 0) queueAnimation(runId, step.startAtMs, () => {
        setAnimatedTrick((current) =>
          current
            ? {
                ...current,
                visiblePlayCount: Math.max(current.visiblePlayCount, index + 1),
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
    const finishWithoutWinAt = lastPlay.startAtMs + lastPlay.durationMs + CARD_TIMING.unfinishedTrickHoldMs;
    if (!trickAnimation.resolution) {
      queueAnimation(runId, finishWithoutWinAt, () => {
        clearAnimationTimeline();
        runNextAnimationSegment();
      });
      return;
    }

    const resolution = trickAnimation.resolution;
    const restTable = () => {
      setAnimatedTrick((current) => current ? {
        ...current, phase: "resting", pointsVisible: false, pointsPulse: false
      } : current);
      queueAnimation(runId, resolution.restDurationMs, () => {
        clearAnimationTimeline();
        runNextAnimationSegment();
      });
    };
    const collectTrick = () => {
      setAnimatedTrick((current) => current ? {
        ...current, phase: "collecting", pointsPulse: false
      } : current);
      queueAnimation(runId, resolution.collectDurationMs, restTable);
    };
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
      // Schedule each phase from the preceding phase, so a busy browser cannot
      // consume the reading/rest time by running overdue timers together.
      queueAnimation(runId, Math.min(CARD_TIMING.pointsPulseMs, resolution.highlightDurationMs), () => {
        setAnimatedTrick((current) => (current ? { ...current, pointsPulse: false } : current));
      });
      queueAnimation(runId, resolution.highlightDurationMs, collectTrick);
    });
  }

  function applySession(response: SessionResponse, options?: { deferSnapshot?: boolean; forceCommit?: boolean }) {
    const committed = committedSessionRef.current;
    if (committed?.sessionId === response.sessionId && response.snapshot.lastEventSequence < committed.snapshot.lastEventSequence) return;
    const shouldDeferSnapshot = !options?.forceCommit && (options?.deferSnapshot || pendingPlayRef.current || animatedTrickRef.current !== null);

    setSessionId((current) => (current === response.sessionId ? current : response.sessionId));
    if (persistSession) {
      writeStorage(SESSION_KEY, response.sessionId);
    }
    lastSequenceRef.current = Math.max(lastSequenceRef.current, response.snapshot.lastEventSequence);

    if (shouldDeferSnapshot) {
      if (!deferredSessionRef.current || response.snapshot.lastEventSequence >= deferredSessionRef.current.snapshot.lastEventSequence) {
        deferredSessionRef.current = response;
      }
      return;
    }

    commitSessionSnapshot(response);
  }

  function commitSessionSnapshot(response: SessionResponse) {
    committedSessionRef.current = response;
    deferredSessionRef.current = null;
    setSnapshot(response.snapshot);
    setHiddenHandIndex(null);
    setPendingBelaChoiceIndex(null);
    // Local preferences also describe the next match; snapshots must not overwrite them.
    setErrorMessage(response.snapshot.pendingAction.validationCode ?? (response.snapshot.pendingAction.validationMessage ? "error.unknown" : null));
  }

  function flushDeferredSession() {
    const generation = sessionGenerationRef.current;
    const refreshSessionId = deferredRefreshSessionIdRef.current;
    deferredRefreshSessionIdRef.current = null;
    const deferredSession = deferredSessionRef.current;

    // Commit the known final state before removing its animated representation.
    // A background refresh must never expose the old hand/trick in between.
    if (deferredSession) commitSessionSnapshot(deferredSession);
    animatedTrickRef.current = null;
    setAnimatedTrick(null);
    setSelectedHandIndex(null);

    if (refreshSessionId) {
      void gateway
        .getSession(refreshSessionId)
        .then((response) => {
          if (generation === sessionGenerationRef.current) applySession(response);
        })
        .catch(() => {
          if (generation !== sessionGenerationRef.current) return;
          if (deferredSession) return;
          setErrorMessage("error.refresh");
        });
      return;
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
    const generation = sessionGenerationRef.current;
    const history = await gateway.getSessionEvents(id, afterSequence);
    if (generation === sessionGenerationRef.current) appendHistory(history);
  }

  async function recoverMissingSession(error: unknown) {
    if (!isMissingSessionError(error)) {
      return false;
    }

    sessionGenerationRef.current += 1;
    committedSessionRef.current = null;
    pendingPlayRef.current = false;
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
      removeStorage(SESSION_KEY);
    }

    try {
      const response = await createConfiguredSession();
      applyFreshSession(response);
      setErrorMessage("error.freshSession");
    } catch (creationError) {
      setErrorMessage(errorCode(creationError));
    }
    return true;
  }

  async function createConfiguredSession() {
    const created = await gateway.createSession();
    return gateway.updateLobbySettings(created.sessionId, gameSettings.difficulty, playerNames,
      teamNames, gameSettings.matchTargetWins, gameSettings.gameLength);
  }

  function applyFreshSession(response: SessionResponse) {
    applySession(response, { forceCommit: true });
    const generation = sessionGenerationRef.current;
    void syncEvents(response.sessionId, 0).catch(() => {
      if (generation === sessionGenerationRef.current) setErrorMessage("error.refresh");
    });
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
  const highlightedSeat = animatedTrick && ["highlight", "collecting"].includes(animatedTrick.phase) ? animatedTrick.winnerSeat : null;
  const handLocked = commandPending || selectedHandIndex !== null || animatedTrick !== null || pendingBelaChoiceIndex !== null;
  const southPlayer = playersBySeat.SOUTH;
  const belaChoiceCard =
    pendingBelaChoiceIndex != null && southPlayer?.hand[pendingBelaChoiceIndex]
      ? southPlayer.hand[pendingBelaChoiceIndex]
      : null;
  const gameCompleteSummary = sessionResetting ? null : latestGameCompleteSummary(snapshot, events);
  const matchCompleteSummary = sessionResetting ? null : latestMatchCompleteSummary(snapshot, events);
  const canQuitMatch = snapshot !== null && snapshot.phase !== "READY_TO_START" && !snapshot.matchComplete && !handLocked;
  const canForfeitGame =
    snapshot !== null &&
    snapshot.score.gameNumber > 0 &&
    !snapshot.matchComplete &&
    snapshot.pendingAction.type !== "START_MATCH" &&
    snapshot.pendingAction.type !== "START_NEXT_GAME" &&
    !handLocked;

  const isChoosingTrump = snapshot?.pendingAction.type === "CHOOSE_TRUMP";
  const isTableAction = isChoosingTrump || snapshot?.pendingAction.type === "REPORT_MELDS";
  const actionPanel = (
    <ActionPanel
      busy={commandPending || (selectedHandIndex !== null && pendingBelaChoiceIndex === null)}
      pendingAction={snapshot?.pendingAction}
      errorMessage={errorMessage}
      playerNames={playerNameDrafts}
      teamNames={teamNameDrafts}
      yourTeamName={playersBySeat.SOUTH?.team}
      gameSettings={gameSettings}
      gameCompleteSummary={gameCompleteSummary}
      matchCompleteSummary={matchCompleteSummary}
      onPlayerNameChange={handlePlayerNameChange}
      onTeamNameChange={handleTeamNameChange}
      onGameSettingsChange={handleGameSettingsChange}
      onStart={() => void handleStartMatch()}
      onStartWithGuide={() => void handleStartMatch(true)}
      onStartRematch={handleStartRematch}
      onOpenSettingsMenu={handleOpenSettingsMenu}
      onChooseTrump={handleChooseTrump}
      onReportMelds={handleReportMelds}
      onAcknowledgeMelds={handleAcknowledgeMelds}
      pendingBelaChoiceCard={belaChoiceCard}
      onPlayWithBela={handlePlayWithBela}
      onPlayWithoutBela={handlePlayWithoutBela}
      onOpenBook={() => setShowBook("welcome")}
      visual={visual}
      onVisualChange={patch => setVisual(current => ({ ...current, ...patch }))}
    />
  );

  return (
    <PlaybackProvider value={{ settings: playback, onChange: handlePlaybackChange }}>
    <CardStyleProvider value={paintedCardStyle}>
    <main className="app-shell game-layout">
      <div className={`table-stage ${snapshot?.pendingAction.type === "START_MATCH" ? "table-stage-setup" : ""}`}>
        <TableLayout
          tableActionPanel={isTableAction ? actionPanel : undefined}
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
          canForfeitGame={canForfeitGame}
          canQuitMatch={canQuitMatch}
          onForfeitGame={() => setConfirmExit("game")}
          onQuitMatch={() => setConfirmExit("match")}
          onOpenBook={() => setShowBook("welcome")}
        />
        {!isTableAction ? actionPanel : null}
        {!snapshot && !sessionResetting ? <SessionStatus pending={connecting} error={errorMessage}
          onRetry={() => void bootstrapSession()} /> : null}
      </div>
      <section className="after-table">
        <TerminalLog events={events} matchComplete={snapshot?.matchComplete} yourTeamName={playersBySeat.SOUTH?.team}
          currentMove={<CurrentMove snapshot={snapshot} animatedTrick={animatedTrick} />} />
      </section>
      {showBook && <GuideBook initialChapter={showBook} onClose={() => setShowBook(null)} />}
      {confirmExit ? <ConfirmPopup kind={confirmExit} onCancel={() => setConfirmExit(null)} onConfirm={() => {
        setConfirmExit(null);
        if (confirmExit === "game") void handleForfeitGame();
        else void handleQuitMatch();
      }} /> : null}
    </main>
    </CardStyleProvider>
    </PlaybackProvider>
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
  const storedTheme = typeof window === "undefined" ? null : readStorage(THEME_KEY);
  return {
    difficulty: "NORMAL",
    matchTargetWins: 3,
    gameLength: "LONG",
    tableTheme: isTableTheme(storedTheme) ? storedTheme : "DARK_BLUE"
  };
}

function toTeamNames(snapshot: GameSnapshot): TeamNameDrafts {
  return {
    yourTeam: snapshot.score.teamOneName,
    enemyTeam: snapshot.score.teamTwoName
  };
}

function toDifficulty(value: string | null | undefined): GameSettingsDrafts["difficulty"] {
  return value === "EASY" || value === "HARD" ? value : "NORMAL";
}

function toMatchTargetWins(value: number | null | undefined): MatchTargetWins {
  return value === 1 || value === 5 ? value : 3;
}

function isTableTheme(value: string | null): value is TableTheme {
  return TABLE_THEMES.includes(value as TableTheme);
}

function latestGameCompleteSummary(snapshot: GameSnapshot | null, events: GameEvent[]): GameCompleteSummary | null {
  if (!snapshot || snapshot.pendingAction.type !== "START_NEXT_GAME") {
    return null;
  }

  const latest = [...events].reverse().find((event) => event.payload.eventKind === "GAME_WIN");
  const teamOne = {
    name: snapshot.score.teamOneName,
    gamePoints: snapshot.score.teamOneGamePoints,
    matchWins: snapshot.score.teamOneMatchScore
  };
  const teamTwo = {
    name: snapshot.score.teamTwoName,
    gamePoints: snapshot.score.teamTwoGamePoints,
    matchWins: snapshot.score.teamTwoMatchScore
  };

  const eventWinnerName = latest?.payload.winner;
  const winner =
    eventWinnerName === teamOne.name
      ? teamOne
      : eventWinnerName === teamTwo.name
        ? teamTwo
        : teamOne.gamePoints >= teamTwo.gamePoints
          ? teamOne
          : teamTwo;
  const loser = winner.name === teamOne.name ? teamTwo : teamOne;

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
    byForfeit: latest?.payload.byForfeit === "true"
  };
}

function latestMatchCompleteSummary(snapshot: GameSnapshot | null, events: GameEvent[]): MatchCompleteSummary | null {
  if (!snapshot?.matchComplete) {
    return null;
  }

  const latestMatch = [...events].reverse().find((event) => event.payload.eventKind === "MATCH_WIN");
  const latestGame = [...events].reverse().find((event) => event.payload.eventKind === "GAME_WIN");
  const teamOne = {
    name: snapshot.score.teamOneName,
    gamePoints: snapshot.score.teamOneGamePoints,
    matchWins: snapshot.score.teamOneMatchScore
  };
  const teamTwo = {
    name: snapshot.score.teamTwoName,
    gamePoints: snapshot.score.teamTwoGamePoints,
    matchWins: snapshot.score.teamTwoMatchScore
  };

  const eventWinnerName = latestMatch?.payload.winner;
  const winner =
    eventWinnerName === teamOne.name
      ? teamOne
      : eventWinnerName === teamTwo.name
        ? teamTwo
        : teamOne.matchWins >= teamTwo.matchWins
          ? teamOne
          : teamTwo;
  const loser = winner.name === teamOne.name ? teamTwo : teamOne;
  const finalGameWinnerPoints = winner.name === teamOne.name ? teamOne.gamePoints : teamTwo.gamePoints;
  const finalGameLoserPoints = winner.name === teamOne.name ? teamTwo.gamePoints : teamOne.gamePoints;

  return {
    winnerName: winner.name,
    loserName: loser.name,
    winnerMatchWins: winner.matchWins,
    loserMatchWins: loser.matchWins,
    matchTargetWins: snapshot.score.matchTargetWins,
    finalGameWinnerPoints,
    finalGameLoserPoints,
    finalGameByForfeit: latestGame?.payload.byForfeit === "true",
    gameNumber: snapshot.score.gameNumber
  };
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
    return "code" in error && error.code === "error.session";
  }

  return false;
}

export default App;
