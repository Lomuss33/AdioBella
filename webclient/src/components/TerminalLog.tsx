import { cardDescription, eventDescription, handSettlementDescription } from "../i18n/presentation";
import { t, countText, useLanguage } from "../i18n";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GameEvent } from "../types";

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

function TerminalLog({ events, matchComplete }: { events: GameEvent[]; matchComplete?: boolean }) {
  const orderedEvents = useMemo(
    () => [...new Map(events.map((event) => [event.sequence, event])).values()].sort((left, right) => left.sequence - right.sequence),
    [events]
  );
  const roundGroups = useMemo(() => buildRoundGroups(orderedEvents), [orderedEvents]);
  const matchGroups = useMemo(() => buildMatchFeed(orderedEvents), [orderedEvents]);
  const matchResultCount = matchGroups.reduce((count, group) => count + group.events.length, 0);

  const rounds = useFeedScroll(roundGroups);
  const matches = useFeedScroll(matchGroups);

  return (
    <details className="terminal-panel" open>
      <summary className="terminal-header">
        <div className="terminal-heading">
          <h2>{t("Game history")}</h2>
          <span className={`terminal-status${matchComplete ? " is-complete" : " is-live"}`}>
            <span className="terminal-status-dot" aria-hidden="true" />
            {matchComplete ? t("Match complete") : t("Live feed")}
          </span>
        </div>
        <span className="terminal-disclosure" aria-hidden="true" />
      </summary>
      <div className="terminal-grid">
        <section className="terminal-section" aria-labelledby="round-feed-heading">
          <div className="terminal-subheader">
            <h3 id="round-feed-heading">{t("Round Feed")}</h3>
            <span className="terminal-count">{countText("rounds", roundGroups.length)}</span>
            {rounds.readingOlder ? <button type="button" className="terminal-latest" aria-controls="round-feed-history" onClick={rounds.latest}>{t("Latest")}</button> : null}
          </div>
          <div id="round-feed-history" ref={rounds.ref} onScroll={rounds.capture} className="terminal-lines" role="region" tabIndex={0} aria-label={t("Round history")}>
            {roundGroups.length === 0 ? <div className="terminal-empty">{t("No round events yet.")}</div> : null}
            {roundGroups.map((group) => (
              <section key={group.key} className="terminal-round-group">
                <div className="terminal-round-title" data-history-key={group.key}>
                  <span>{t("historyHeading", { game: group.gameNumber, round: group.roundNumber })}</span>
                  <span className={`terminal-trick-state${group.winner ? " is-complete" : " is-live"}`}>
                    {group.winner ? t("Trick complete") : t("Trick in progress")}
                  </span>
                </div>
                {group.winner ? (
                  <div className="terminal-round-winner" data-history-key={`event-${group.winner.sequence}`}>
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
                    <div key={event.sequence} data-history-key={`event-${event.sequence}`} className="terminal-play-row">
                      <span className="terminal-play-order" aria-hidden="true">{index + 1}</span>
                      <strong className="terminal-play-player">{event.payload.playerName ?? t("player")}</strong>
                      <CompactCardMark rank={event.payload.rank} suit={event.payload.suit} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
        <section className="terminal-section" aria-labelledby="match-feed-heading">
          <div className="terminal-subheader">
            <h3 id="match-feed-heading">{t("Match Feed")}</h3>
            <span className="terminal-count">{countText("results", matchResultCount)}</span>
            {matches.readingOlder ? <button type="button" className="terminal-latest" aria-controls="match-feed-history" onClick={matches.latest}>{t("Latest")}</button> : null}
          </div>
          <div id="match-feed-history" ref={matches.ref} onScroll={matches.capture} className="terminal-lines" role="region" tabIndex={0} aria-label={t("Match history")}>
            {matchGroups.length === 0 ? <div className="terminal-empty">{t("No hand or game results yet.")}</div> : null}
            {matchGroups.map((group) => (
              <section key={group.key} className="terminal-match-game">
                <div className="terminal-match-game-title" data-history-key={group.key}>{t("matchGameHeading", { game: group.gameNumber })}</div>
                {group.events.map((event) => <MatchFeedRow key={event.sequence} event={event} />)}
              </section>
            ))}
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

// Keep the newest event visible at the top unless the player has scrolled back.
function useFeedScroll(items: readonly unknown[]) {
  const { locale } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ key: string; offset: number } | null>(null);
  const pinnedToLatest = useRef(true);
  const [readingOlder, setReadingOlder] = useState(false);
  const capture = useCallback(() => {
    const pane = ref.current;
    if (!pane || pane.clientHeight === 0) return;
    const older = pane.scrollTop > 8;
    setReadingOlder(older);
    pinnedToLatest.current = !older;
    if (!older) { anchor.current = null; return; }
    const top = pane.getBoundingClientRect().top;
    const row = [...pane.querySelectorAll<HTMLElement>("[data-history-key]")]
      .find((element) => element.getBoundingClientRect().bottom > top);
    anchor.current = row ? { key: row.dataset.historyKey!, offset: row.getBoundingClientRect().top - top } : null;
  }, [setReadingOlder]);
  useEffect(() => {
    window.addEventListener("belot:before-language-change", capture);
    return () => window.removeEventListener("belot:before-language-change", capture);
  }, [capture]);
  useLayoutEffect(() => {
    const pane = ref.current;
    if (!pane || pane.clientHeight === 0) return;
    if (pinnedToLatest.current) {
      pane.scrollTop = 0;
      anchor.current = null;
      capture();
      return;
    }
    const saved = anchor.current;
    if (saved) {
      const row = [...pane.querySelectorAll<HTMLElement>("[data-history-key]")]
        .find((element) => element.dataset.historyKey === saved.key);
      if (row) pane.scrollTop += row.getBoundingClientRect().top - pane.getBoundingClientRect().top - saved.offset;
    }
    capture();
  }, [items, locale, capture]);
  const latest = () => {
    if (ref.current) ref.current.scrollTop = 0;
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

function MatchFeedRow({ event }: { event: GameEvent }) {
  const isHandResult = event.payload.eventKind === "HAND_PASSED" || event.payload.eventKind === "HAND_FAILED";
  const handSummary = isHandResult ? handSettlementDescription(event) : null;
  return (
    <div data-history-key={`event-${event.sequence}`} className={matchRowClassName(event)}>
      {handSummary ? (
        <span className="terminal-hand-summary">
          <span className="terminal-hand-context-row">
            <span className="terminal-hand-context">{handSummary.context}</span>
            <span className={`terminal-hand-contract${event.payload.eventKind === "HAND_FAILED" ? " is-failed" : " is-passed"}`}>
              {event.payload.eventKind === "HAND_FAILED" ? t("Contract failed") : t("Contract fulfilled")}
            </span>
          </span>
          <strong className="terminal-hand-points">{handSummary.points}</strong>
        </span>
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
    group.events.push(event);
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
