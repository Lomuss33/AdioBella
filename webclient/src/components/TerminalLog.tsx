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
        <h2>{t("Game Terminal")}</h2>
        <span>{matchComplete ? t("Match complete") : t("Live feed")}</span>
      </summary>
      <div className="terminal-grid">
        <section className="terminal-section">
          <div className="terminal-subheader">
            <span className="panel-caption">{t("Round Feed")}</span>
            <span>{countText("rounds", roundGroups.length)}</span>
            {rounds.readingOlder ? <button type="button" className="terminal-latest" onClick={rounds.latest}>{t("Latest rounds ↑")}</button> : null}
          </div>
          <div ref={rounds.ref} onScroll={rounds.capture} className="terminal-lines" tabIndex={0} aria-label={t("Round history")}>
            {roundGroups.length === 0 ? <div className="terminal-empty">{t("No round events yet.")}</div> : null}
            {roundGroups.map((group) => (
              <section key={group.key} className="terminal-round-group">
                <div className="terminal-round-title" data-history-key={group.key}>
                  {t("historyHeading", { game: group.gameNumber, round: group.roundNumber })}
                </div>
                {group.plays.map((event) => (
                  <div key={event.sequence} data-history-key={`event-${event.sequence}`} className="terminal-play-row">
                    <span className="terminal-seq">#{event.sequence}</span>
                    <span>{eventDescription(event)}</span>
                  </div>
                ))}
                {group.winner ? (
                  <div className="terminal-round-winner" data-history-key={`event-${group.winner.sequence}`}>
                    <span className="terminal-seq">#{group.winner.sequence}</span>
                    <span>
                      <strong>{t("round winner")}</strong> {eventDescription(group.winner)}
                    </span>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </section>
        <section className="terminal-section">
          <div className="terminal-subheader">
            <span className="panel-caption">{t("Match Feed")}</span>
            <span>{countText("updates", matchEvents.length)}</span>
            {matches.readingOlder ? <button type="button" className="terminal-latest" onClick={matches.latest}>{t("Latest results ↑")}</button> : null}
          </div>
          <div ref={matches.ref} onScroll={matches.capture} className="terminal-lines" tabIndex={0} aria-label={t("Match history")}>
            {matchEvents.length === 0 ? <div className="terminal-empty">{t("No game or match winners yet.")}</div> : null}
            {matchEvents.map((event) => (
              <div key={event.sequence} data-history-key={`event-${event.sequence}`} className={matchRowClassName(event)}>
                <span className="terminal-seq">#{event.sequence}</span>
                <span>{eventDescription(event)}</span>
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

// Anchor the visible entry when new events are inserted above a reader.
function useFeedScroll(items: readonly unknown[]) {
  const { locale } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ key: string; offset: number } | null>(null);
  const [readingOlder, setReadingOlder] = useState(false);
  const capture = () => {
    const pane = ref.current;
    if (!pane || pane.clientHeight === 0) return;
    const older = pane.scrollTop > 8;
    setReadingOlder(older);
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
    const saved = anchor.current;
    if (saved) {
      const row = [...pane.querySelectorAll<HTMLElement>("[data-history-key]")]
        .find((element) => element.dataset.historyKey === saved.key);
      if (row) pane.scrollTop += row.getBoundingClientRect().top - pane.getBoundingClientRect().top - saved.offset;
      else pane.scrollTop = 0;
    } else pane.scrollTop = 0;
    capture();
  }, [items, locale]);
  const latest = () => {
    if (ref.current) ref.current.scrollTop = 0;
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

  return [...groups].reverse();
}

function buildMatchFeed(events: GameEvent[]) {
  return events
    .filter((event) => {
      const message = event.message.toLowerCase();
      return message.includes("won the game") || message.includes("won the match");
    })
    .reverse();
}

function matchRowClassName(event: GameEvent) {
  const message = event.message.toLowerCase();
  if (message.includes("won the match")) {
    return "terminal-line terminal-match-winner";
  }
  return "terminal-line terminal-game-winner";
}

export default TerminalLog;
