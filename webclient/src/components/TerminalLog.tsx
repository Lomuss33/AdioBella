import { useEffect, useMemo, useRef } from "react";
import type { GameEvent } from "../types";

function TerminalLog({ events, matchComplete }: { events: GameEvent[]; matchComplete?: boolean }) {
  const roundLinesRef = useRef<HTMLDivElement | null>(null);
  const matchLinesRef = useRef<HTMLDivElement | null>(null);
  const orderedEvents = useMemo(
    () => [...events].sort((left, right) => left.sequence - right.sequence),
    [events]
  );
  const roundGroups = useMemo(() => buildRoundGroups(orderedEvents), [orderedEvents]);
  const matchEvents = useMemo(() => buildMatchFeed(orderedEvents), [orderedEvents]);

  useEffect(() => {
    if (roundLinesRef.current) {
      roundLinesRef.current.scrollTop = 0;
    }
    if (matchLinesRef.current) {
      matchLinesRef.current.scrollTop = 0;
    }
  }, [roundGroups, matchEvents]);

  return (
    <section className="terminal-panel">
      <div className="terminal-header">
        <h1>Game Terminal</h1>
        <span>{matchComplete ? "Match complete" : "Live feed"}</span>
      </div>
      <div className="terminal-grid">
        <section className="terminal-section">
          <div className="terminal-subheader">
            <span className="panel-caption">Round Feed</span>
            <span>{roundGroups.length} rounds</span>
          </div>
          <div ref={roundLinesRef} className="terminal-lines">
            {roundGroups.length === 0 ? <div className="terminal-empty">No round events yet.</div> : null}
            {roundGroups.map((group) => (
              <section key={group.key} className="terminal-round-group">
                <div className="terminal-round-title">
                  game {group.gameNumber} round {group.roundNumber}
                </div>
                {group.plays.map((event) => (
                  <div key={event.sequence} className="terminal-play-row">
                    <span className="terminal-seq">#{event.sequence}</span>
                    <span>{event.message}</span>
                  </div>
                ))}
                {group.winner ? (
                  <div className="terminal-round-winner">
                    <span className="terminal-seq">#{group.winner.sequence}</span>
                    <span>
                      <strong>round winner</strong> {group.winner.message}
                    </span>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </section>
        <section className="terminal-section">
          <div className="terminal-subheader">
            <span className="panel-caption">Match Feed</span>
            <span>{matchEvents.length} updates</span>
          </div>
          <div ref={matchLinesRef} className="terminal-lines">
            {matchEvents.length === 0 ? <div className="terminal-empty">No game or match winners yet.</div> : null}
            {matchEvents.map((event) => (
              <div key={event.sequence} className={matchRowClassName(event)}>
                <span className="terminal-seq">#{event.sequence}</span>
                <span>{event.message}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

interface RoundGroup {
  key: string;
  gameNumber: number;
  roundNumber: number;
  plays: GameEvent[];
  winner: GameEvent | null;
}

function buildRoundGroups(events: GameEvent[]) {
  const groups: RoundGroup[] = [];
  let gameNumber = 1;
  let roundNumber = 1;
  let currentGroup: RoundGroup | null = null;

  for (const event of events) {
    const gameStartMatch = event.message.match(/^Game (\d+) started\./);
    if (gameStartMatch) {
      gameNumber = Number(gameStartMatch[1]);
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
  if (message.includes("won the match") || message.includes("won the game")) {
    return "terminal-line terminal-match-winner";
  }
  return "terminal-line terminal-game-winner";
}

export default TerminalLog;
