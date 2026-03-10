import type { GameEvent } from "../types";

export function openEventStream(
  sessionId: string,
  afterSequence: number,
  handlers: {
    onEvent: (event: GameEvent) => void;
    onError: () => void;
  }
): EventSource {
  const source = new EventSource(`/api/sessions/${sessionId}/stream?afterSequence=${afterSequence}`);
  source.onmessage = (message) => {
    handlers.onEvent(JSON.parse(message.data) as GameEvent);
  };
  source.onerror = () => {
    handlers.onError();
  };
  return source;
}
