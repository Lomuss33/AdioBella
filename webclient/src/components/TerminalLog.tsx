import { cardDescription, eventDescription, handSettlementDescription } from "../i18n/presentation";
import { t, countText, useLanguage } from "../i18n";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { GameEvent } from "../types";
import { seatSide, teamSide } from "../lib/teamSide";
import HistoryScrollbar from "./HistoryScrollbar";

const compactRanks: Record<string, string> = {
  SEVEN: "7", EIGHT: "8", NINE: "9", TEN: "10", JACK: "J", QUEEN: "Q", KING: "K", ACE: "A"
};
const compactSuits: Record<string, string> = {
  CLUBS: "♣", DIAMONDS: "♦", HEARTS: "♥", SPADES: "♠"
};

function CompactCardMark({ rank, suit }: { rank?: string; suit?: string }) {
  const accessibleName = cardDescription({ rank: rank ?? null, suit: suit ?? null, faceUp: true });
  const compactRank = rank ? compactRanks[rank] : undefined;
  const compactSuit = suit ? compactSuits[suit] : undefined;

  if (!compactRank || !compactSuit) {
    return <span className="terminal-play-card">{accessibleName}</span>;
  }

  return (
    <span className={`terminal-play-card${suit === "HEARTS" || suit === "DIAMONDS" ? " is-red-suit" : ""}`} aria-label={accessibleName} title={accessibleName}>
      <span>{compactRank}</span><span className="terminal-card-suit" aria-hidden="true">{compactSuit}</span>
    </span>
  );
}

function TerminalLog({ events, matchComplete, yourTeamName, currentMove }: { events: GameEvent[]; matchComplete?: boolean; yourTeamName?: string; currentMove?: ReactNode }) {
  const orderedEvents = useMemo(
    () => [...new Map(events.map((event) => [event.sequence, event])).values()].sort((left, right) => left.sequence - right.sequence),
    [events]
  );
  const roundGroups = useMemo(() => buildRoundGroups(orderedEvents), [orderedEvents]);
  const [newestRoundFirst, setNewestRoundFirst] = useState(true);
  const visibleRounds = useMemo(() => newestRoundFirst ? roundGroups : [...roundGroups].reverse(), [roundGroups, newestRoundFirst]);
  const matchGroups = useMemo(() => buildMatchFeed(orderedEvents), [orderedEvents]);
  const matchResultCount = matchGroups.reduce((count, group) => count + group.events.length, 0);

  const rounds = useFeedScroll(visibleRounds, newestRoundFirst);
  const matches = useFeedScroll(matchGroups);

  return (
    <details className="terminal-panel" open>
      <summary className="terminal-header">
        <div className={`terminal-heading${matchComplete ? " is-complete" : " is-live"}`}>
          <span className="terminal-heading-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 6v12M11 5h8M11 12h6M11 19h8" />
              <path d="m6 3 2 2-2 2-2-2Zm0 7 2 2-2 2-2-2Zm0 7 2 2-2 2-2-2Z" />
            </svg>
          </span>
          <h2>{t(matchComplete ? "Game history" : "Live game history")}</h2>
        </div>
        <span className="terminal-disclosure" aria-hidden="true" />
      </summary>
      {currentMove}
      <div className="terminal-grid">
        <section className="terminal-section" aria-labelledby="round-feed-heading">
          <div className="terminal-subheader">
            <h3 id="round-feed-heading">{t("Round Feed")}</h3>
            <span className="terminal-count">{countText("rounds", roundGroups.length)}</span>
            <button type="button" className="terminal-latest" aria-controls="round-feed-history" onClick={rounds.latest}
              disabled={!rounds.readingOlder} aria-hidden={!rounds.readingOlder}>{t("Latest")}</button>
            <button type="button" className="terminal-feed-order" aria-controls="round-feed-history"
              aria-pressed={!newestRoundFirst}
              aria-label={t(newestRoundFirst ? "Show oldest first" : "Show newest first")}
              title={t(newestRoundFirst ? "Show oldest first" : "Show newest first")}
              onClick={() => setNewestRoundFirst(value => !value)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={newestRoundFirst ? "" : "is-reversed"}>
                <path d="M8 20V4m-4 4 4-4 4 4M15 8h5m-5 4h4m-4 4h3" />
              </svg>
              <span>{t(newestRoundFirst ? "Newest" : "Oldest")}</span>
            </button>
          </div>
          <div className="terminal-feed-window">
          <div id="round-feed-history" ref={rounds.ref} onScroll={rounds.capture} className="terminal-lines" role="region" aria-label={t("Round history")}>
            {roundGroups.length === 0 ? <div className="terminal-empty">{t("No round events yet.")}</div> : null}
            {visibleRounds.map((group) => (
              <section key={group.key} className="terminal-round-group">
                <div className="terminal-round-title" data-history-key={group.key}>
                  <span>{t("historyHeading", { game: group.gameNumber, round: group.roundNumber })}</span>
                  <span className={`terminal-trick-state${group.winner ? " is-complete" : " is-live"}`}>
                    {group.winner ? t("Trick complete") : t("Trick in progress")}
                  </span>
                </div>
                {group.winner ? (
                  <div className="terminal-round-winner" data-team={eventSide(group.winner, yourTeamName)} data-history-key={`event-${group.winner.sequence}`}>
                    <span className="terminal-round-winner-label">{t("round winner")}</span>
                    <span className="terminal-round-winner-identity">
                      <strong>{group.winner.payload.winnerPlayerName ?? t("team")}</strong>
                      {group.winner.payload.team ? <span className="terminal-round-winner-team">· {group.winner.payload.team}</span> : null}
                    </span>
                    <strong className="terminal-round-points">{countText("points", Number(group.winner.payload.trickPoints ?? 0))}</strong>
                    {Number(group.winner.payload.lastTrickBonus) > 0
                      ? <span className="terminal-last-trick-bonus">{t("lastTrickBonusSummary", { points: countText("points", Number(group.winner.payload.lastTrickBonus)) })}</span>
                      : null}
                  </div>
                ) : null}
                <div className="terminal-play-list">
                  {group.plays.map((event, index) => (
                    <div key={event.sequence} data-history-key={`event-${event.sequence}`} data-team={eventSide(event, yourTeamName)} className="terminal-play-row">
                      <span className="terminal-play-order" aria-hidden="true">{index + 1}</span>
                      <strong className="terminal-play-player">{event.payload.playerName ?? t("player")}</strong>
                      <CompactCardMark rank={event.payload.rank} suit={event.payload.suit} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <HistoryScrollbar paneRef={rounds.ref} controls="round-feed-history" label={t("Round history")}
            revision={visibleRounds} onPositionChange={rounds.capture} />
          </div>
        </section>
        <section className="terminal-section" aria-labelledby="match-feed-heading">
          <div className="terminal-subheader">
            <h3 id="match-feed-heading">{t("Match Feed")}</h3>
            <span className="terminal-count">{countText("results", matchResultCount)}</span>
            <button type="button" className="terminal-latest" aria-controls="match-feed-history" onClick={matches.latest}
              disabled={!matches.readingOlder} aria-hidden={!matches.readingOlder}>{t("Latest")}</button>
          </div>
          <div className="terminal-feed-window">
          <div id="match-feed-history" ref={matches.ref} onScroll={matches.capture} className="terminal-lines" role="region" aria-label={t("Match history")}>
            {matchGroups.length === 0 ? <div className="terminal-empty">{t("No hand or game results yet.")}</div> : null}
            {matchGroups.map((group) => (
              <section key={group.key} className="terminal-match-game">
                <div className="terminal-match-game-title" data-history-key={group.key}>{t("matchGameHeading", { game: group.gameNumber })}</div>
                {group.events.map((event) => <MatchFeedRow key={event.sequence} event={event} yourTeamName={yourTeamName} />)}
              </section>
            ))}
          </div>
          <HistoryScrollbar paneRef={matches.ref} controls="match-feed-history" label={t("Match history")}
            revision={matchGroups} onPositionChange={matches.capture} />
          </div>
        </section>
      </div>
    </details>
  );
}

interface RoundGroup {
  key: string;
  gameNumber: number;
  roundNumber: number;
  plays: GameEvent[];
  winner: GameEvent | null;
}

// Follow the newest event at either edge, preserving the reading position otherwise.
function useFeedScroll(items: readonly unknown[], newestFirst = true) {
  const { locale } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ key: string; offset: number; height: number } | null>(null);
  const pinnedToLatest = useRef(true);
  const previousDirection = useRef(newestFirst);
  const [readingOlder, setReadingOlder] = useState(false);
  const capture = useCallback(() => {
    const pane = ref.current;
    if (!pane || pane.clientHeight === 0) return;
    const older = newestFirst ? pane.scrollTop > 8 : pane.scrollHeight - pane.clientHeight - pane.scrollTop > 8;
    setReadingOlder(older);
    pinnedToLatest.current = !older;
    if (!older) { anchor.current = null; return; }
    const top = pane.getBoundingClientRect().top;
    const row = [...pane.querySelectorAll<HTMLElement>("[data-history-key]")]
      .find((element) => element.getBoundingClientRect().bottom > top);
    const bounds = row?.getBoundingClientRect();
    anchor.current = row && bounds ? { key: row.dataset.historyKey!, offset: bounds.top - top, height: bounds.height } : null;
  }, [newestFirst]);
  useEffect(() => {
    const pane = ref.current;
    const surface = pane?.parentElement;
    if (!pane || !surface) return;
    const scrollDown = (delta: number, event: Event) => {
      const page = document.scrollingElement ?? document.documentElement;
      const atPageBottom = page.scrollHeight - page.clientHeight - page.scrollTop <= 1;
      const remaining = pane.scrollHeight - pane.clientHeight - pane.scrollTop;
      if (!event.cancelable || delta <= 0 || !atPageBottom || remaining <= 1) return;
      event.preventDefault();
      pane.scrollTop += Math.min(delta * 0.15, remaining);
      capture();
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pane.clientHeight : 1;
      scrollDown(event.deltaY * unit, event);
    };
    let touchY: number | null = null;
    const touchStart = (event: TouchEvent) => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) { touchY = null; return; }
      const nextY = event.touches[0].clientY;
      if (touchY !== null) scrollDown(touchY - nextY, event);
      touchY = nextY;
    };
    surface.addEventListener("wheel", wheel, { passive: false });
    surface.addEventListener("touchstart", touchStart, { passive: true });
    surface.addEventListener("touchmove", touchMove, { passive: false });
    return () => {
      surface.removeEventListener("wheel", wheel);
      surface.removeEventListener("touchstart", touchStart);
      surface.removeEventListener("touchmove", touchMove);
    };
  }, [capture]);
  useEffect(() => {
    window.addEventListener("belot:before-language-change", capture);
    return () => window.removeEventListener("belot:before-language-change", capture);
  }, [capture]);
  const restore = useCallback(() => {
    const pane = ref.current;
    if (!pane || pane.clientHeight === 0) return;
    if (previousDirection.current !== newestFirst) {
      previousDirection.current = newestFirst;
      pinnedToLatest.current = true;
      anchor.current = null;
    }
    if (pinnedToLatest.current) {
      pane.scrollTop = newestFirst ? 0 : pane.scrollHeight;
      anchor.current = null;
      capture();
      return;
    }
    const saved = anchor.current;
    if (saved) {
      const row = [...pane.querySelectorAll<HTMLElement>("[data-history-key]")]
        .find((element) => element.dataset.historyKey === saved.key);
      if (row) {
        const bounds = row.getBoundingClientRect();
        // Preserve progress through a partially visible entry when wrapping
        // changes its height; a fixed negative offset could hide it entirely.
        const offset = saved.offset < 0 && saved.height > 0 ? saved.offset * bounds.height / saved.height : saved.offset;
        pane.scrollTop += bounds.top - pane.getBoundingClientRect().top - offset;
      }
    }
    capture();
  }, [capture, newestFirst]);
  useLayoutEffect(() => {
    restore();
    const pane = ref.current;
    if (!pane) return;
    // Width changes, font changes and reopening collapsed history can reflow
    // entries without adding an event. Keep the same entry and reading offset.
    const observer = new ResizeObserver(restore);
    observer.observe(pane);
    for (const child of pane.children) observer.observe(child);
    return () => observer.disconnect();
  }, [items, locale, restore]);
  const latest = () => {
    if (ref.current) ref.current.scrollTop = newestFirst ? 0 : ref.current.scrollHeight;
    pinnedToLatest.current = true;
    anchor.current = null;
    setReadingOlder(false);
  };
  return { ref, capture, readingOlder, latest };
}

function buildRoundGroups(events: GameEvent[]) {
  const groups: RoundGroup[] = [];
  let gameNumber = 1;
  let roundNumber = 1;
  let currentGroup: RoundGroup | null = null;

  for (const event of events) {
    if (event.payload.eventKind === "GAME_START") {
      gameNumber = Number(event.payload.gameNumber) || gameNumber;
      roundNumber = 1;
      currentGroup = null;
      continue;
    }

    const eventKind = event.payload.eventKind;
    if (eventKind !== "PLAY_CARD" && eventKind !== "TRICK_WIN") {
      continue;
    }

    if (!currentGroup) {
      currentGroup = {
        key: `game-${gameNumber}-round-${roundNumber}-${event.sequence}`,
        gameNumber,
        roundNumber,
        plays: [],
        winner: null
      };
      groups.push(currentGroup);
    }

    if (eventKind === "PLAY_CARD") {
      currentGroup.plays.push(event);
      continue;
    }

    currentGroup.winner = event;
    currentGroup = null;
    roundNumber += 1;
  }

  return groups.reverse();
}

interface MatchGroup {
  key: string;
  gameNumber: number;
  events: GameEvent[];
}

function eventSide(event: GameEvent, yourTeamName?: string) {
  return seatSide(event.payload.winnerSeat ?? event.payload.playerSeat)
    ?? teamSide(event.payload.team ?? event.payload.winner, yourTeamName);
}

function MatchFeedRow({ event, yourTeamName }: { event: GameEvent; yourTeamName?: string }) {
  const isHandResult = event.payload.eventKind === "HAND_PASSED" || event.payload.eventKind === "HAND_FAILED";
  const handSummary = isHandResult ? handSettlementDescription(event) : null;
  return (
    <div data-history-key={`event-${event.sequence}`} data-team={eventSide(event, yourTeamName)} className={matchRowClassName(event)}>
      {handSummary ? (
        <div className="terminal-hand-summary">
          <div className="terminal-hand-context-row">
            <strong className="terminal-hand-number">{t("history.hand", { number: event.payload.handNumber ?? "—" })}</strong>
            <span className={`terminal-hand-contract${event.payload.eventKind === "HAND_FAILED" ? " is-failed" : " is-passed"}`}>
              <span aria-hidden="true">{event.payload.eventKind === "HAND_FAILED" ? "×" : "✓"} </span>
              {event.payload.eventKind === "HAND_FAILED" ? t("Contract failed") : t("Contract fulfilled")}
            </span>
          </div>
          <div className="terminal-hand-scoreboard" aria-label={t("history.awarded")}>
            {handSummary.scores.map((score, index) => (
              <div key={index} className="terminal-hand-score" data-team={teamSide(score.team, yourTeamName)}
                data-leading={score.points > handSummary.scores[1 - index].points || undefined}>
                <span className="terminal-hand-team">{score.team}</span>
                <strong className="terminal-hand-score-value">+{score.points}</strong>
                <span className="terminal-hand-score-unit">{t("Points")}</span>
              </div>
            ))}
          </div>
          <dl className="terminal-hand-details">
            <div><dt>{t("history.dealer")}</dt><dd>{handSummary.dealer}</dd></div>
            <div><dt>{t("Trump")}</dt><dd><span className="terminal-hand-trump-mark" aria-hidden="true">{compactSuits[event.payload.trump]}</span>{handSummary.suit}<span className="terminal-hand-caller">{handSummary.trumpPlayer}</span></dd></div>
            <div className="terminal-hand-meld"><dt>{t("Melds")}</dt><dd>{handSummary.meldOutcome}</dd></div>
          </dl>
        </div>
      ) : (
        <span>
          {eventDescription(event)}
          {["GAME_WIN", "GAME_FORFEIT"].includes(event.payload.eventKind) && Number.isFinite(Number(event.payload.winningScore))
            ? <strong className="terminal-result-points"> - {countText("points", Number(event.payload.winningScore))}</strong>
            : null}
          {event.payload.byForfeit === "true" ? <small className="terminal-forfeit">{t("byForfeit")}</small> : null}
        </span>
      )}
    </div>
  );
}

function buildMatchFeed(events: GameEvent[]): MatchGroup[] {
  const groups = new Map<number, MatchGroup>();
  let activeGame = 1;

  for (const event of events) {
    const eventKind = event.payload.eventKind;
    if (eventKind === "GAME_START") {
      activeGame = Number(event.payload.gameNumber) || activeGame;
      continue;
    }
    if (eventKind === "GAME_WIN" && event.payload.byForfeit === "true") {
      continue;
    }
    if (!["HAND_PASSED", "HAND_FAILED", "GAME_WIN", "MATCH_WIN", "GAME_FORFEIT", "MATCH_FORFEIT"].includes(eventKind)) {
      continue;
    }

    const gameNumber = Number(event.payload.gameNumber) || activeGame;
    let group = groups.get(gameNumber);
    if (!group) {
      group = { key: `match-game-${gameNumber}`, gameNumber, events: [] };
      groups.set(gameNumber, group);
    }
    const isHand = eventKind === "HAND_PASSED" || eventKind === "HAND_FAILED";
    const handNumber = group.events.filter(item => ["HAND_PASSED", "HAND_FAILED"].includes(item.payload.eventKind)).length + 1;
    group.events.push(isHand && !event.payload.handNumber
      ? { ...event, payload: { ...event.payload, handNumber: String(handNumber) } }
      : event);
  }

  return [...groups.values()].reverse().map((group) => ({ ...group, events: group.events.reverse() }));
}

function matchRowClassName(event: GameEvent) {
  if (event.payload.eventKind === "MATCH_WIN") {
    return "terminal-line terminal-match-winner";
  }
  if (event.payload.eventKind === "GAME_WIN") {
    return "terminal-line terminal-game-winner";
  }
  if (event.payload.eventKind === "GAME_FORFEIT" || event.payload.eventKind === "MATCH_FORFEIT") {
    return "terminal-line terminal-forfeit-result";
  }
  return "terminal-line terminal-hand-result";
}

export default TerminalLog;
