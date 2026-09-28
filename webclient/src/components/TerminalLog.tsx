import { eventDescription } from "../i18n/presentation";
import { t, countText, useLanguage } from "../i18n";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GameEvent } from "../types";

function TerminalLog({ events, matchComplete }: { events: GameEvent[]; matchComplete?: boolean }) {
  const orderedEvents = useMemo(
    () => [...new Map(events.map((event) => [event.sequence, event])).values()].sort((left, right) => left.sequence - right.sequence),
    [events]
  );
  const roundGroups = useMemo(() => buildRoundGroups(orderedEvents), [orderedEvents]);
  const matchEvents = useMemo(() => buildMatchFeed(orderedEvents), [orderedEvents]);

  const rounds = useFeedScroll(roundGroups);
  const matches = useFeedScroll(matchEvents);

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
                  {t("historyHeading", { game: group.gameNumber, round: group.roundNumber })}
                </div>
                {group.winner ? (
                  <div className="terminal-round-winner" data-history-key={`event-${group.winner.sequence}`}>
                    <span className="terminal-seq">#{group.winner.sequence}</span>
                    <span>
                      <strong>{t("round winner")}</strong> {eventDescription(group.winner)}
                    </span>
                  </div>
                ) : null}
                {[...group.plays].reverse().map((event) => (
                  <div key={event.sequence} data-history-key={`event-${event.sequence}`} className="terminal-play-row">
                    <span className="terminal-seq">#{event.sequence}</span>
                    <span>{eventDescription(event)}</span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </section>
        <section className="terminal-section" aria-labelledby="match-feed-heading">
          <div className="terminal-subheader">
            <h3 id="match-feed-heading">{t("Match Feed")}</h3>
            <span className="terminal-count">{countText("results", matchEvents.length)}</span>
            {matches.readingOlder ? <button type="button" className="terminal-latest" aria-controls="match-feed-history" onClick={matches.latest}>{t("Latest")}</button> : null}
          </div>
          <div id="match-feed-history" ref={matches.ref} onScroll={matches.capture} className="terminal-lines" role="region" tabIndex={0} aria-label={t("Match history")}>
            {matchEvents.length === 0 ? <div className="terminal-empty">{t("No game or match winners yet.")}</div> : null}
            {matchEvents.map((event) => (
              <div key={event.sequence} data-history-key={`event-${event.sequence}`} className={matchRowClassName(event)}>
                <span className="terminal-seq">#{event.sequence}</span>
                <span>
                  {eventDescription(event)}
                  {event.payload.eventKind === "GAME_WIN" && Number.isFinite(Number(event.payload.winningScore))
                    ? <strong className="terminal-result-points"> - {countText("points", Number(event.payload.winningScore))}</strong>
                    : null}
                  {event.payload.byForfeit === "true" ? <small className="terminal-forfeit">{t("byForfeit")}</small> : null}
                </span>
              </div>
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
  const capture = () => {
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
  };
  useEffect(() => {
    window.addEventListener("belot:before-language-change", capture);
    return () => window.removeEventListener("belot:before-language-change", capture);
  });
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
  }, [items, locale]);
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

function buildMatchFeed(events: GameEvent[]) {
  return events
    .filter((event) => event.payload.eventKind === "GAME_WIN" || event.payload.eventKind === "MATCH_WIN")
    .reverse();
}

function matchRowClassName(event: GameEvent) {
  if (event.payload.eventKind === "MATCH_WIN") {
    return "terminal-line terminal-match-winner";
  }
  return "terminal-line terminal-game-winner";
}

export default TerminalLog;
