import { useEffect, useMemo, useRef } from "react";
import type { GameEvent } from "../types";

function TerminalLog({ events, matchComplete }: { events: GameEvent[]; matchComplete?: boolean }) {
  const linesRef = useRef<HTMLDivElement | null>(null);
  const orderedEvents = useMemo(
    () => [...events].sort((left, right) => right.sequence - left.sequence),
    [events]
  );

  useEffect(() => {
    if (!linesRef.current) {
      return;
    }

    linesRef.current.scrollTop = 0;
  }, [orderedEvents]);

  return (
    <section className="terminal-panel">
      <div className="terminal-header">
        <h1>Game Terminal</h1>
        <span>{matchComplete ? "Match complete" : "Live feed"}</span>
      </div>
      <div ref={linesRef} className="terminal-lines">
        {orderedEvents.map((event) => (
          <div key={event.sequence} className={`terminal-line terminal-${event.type.toLowerCase()}`}>
            <span className="terminal-seq">#{event.sequence}</span>
            <span>{event.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default TerminalLog;
