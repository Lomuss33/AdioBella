import { describe, expect, test, vi } from "vitest";
import { GameSession } from "./gameSession";
import { SeededRandom } from "./random";

describe("GameSession", () => {
  test("events are ordered and replayable", () => {
    const session = new GameSession("session-1", "NORMAL", new SeededRandom(7));
    const initialEvents = session.eventsAfter(0);

    expect(initialEvents).toHaveLength(1);

    session.startMatch();
    const allEvents = session.eventsAfter(0);
    const replay = session.eventsAfter(initialEvents[0].sequence);

    expect(allEvents.length).toBeGreaterThan(initialEvents.length);
    expect(replay.length).toBeGreaterThan(0);
    expect(replay[0].sequence).toBeGreaterThan(initialEvents[0].sequence);
  });

  test("subscription replays backlog and emits new events", () => {
    const session = new GameSession("session-1", "NORMAL", new SeededRandom(7));
    const received: number[] = [];
    const listener = vi.fn((event) => {
      received.push(event.sequence);
    });

    const subscription = session.subscribe(0, listener);
    session.startMatch();

    expect(received[0]).toBe(1);
    expect(received.length).toBeGreaterThan(1);
    subscription.close();
  });
});
