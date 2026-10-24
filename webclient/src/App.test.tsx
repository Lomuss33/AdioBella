import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { GameEvent, SessionResponse } from "./types";
import { CARD_TIMING } from "./lib/cardAnimationConfig";

class FakeEventSource {
  static latest: FakeEventSource;
  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: (() => void) | null = null;

  constructor(_url: string) { FakeEventSource.latest = this; }

  close() {}
}

const baseSession: SessionResponse = {
  sessionId: "session-1",
  snapshot: {
    phase: "READY_TO_START",
    trumpSuit: null,
    dealerPlayerId: "east",
    declarerPlayerId: null,
    currentPlayerId: null,
    players: [
      { id: "south", name: "You", seat: "SOUTH", human: true, team: "Us", hand: [], handSize: 0, matchScore: 0, gamePoints: 0, dealer: false, currentTurn: false },
      { id: "west", name: "Zapad", seat: "WEST", human: false, team: "Them", hand: [], handSize: 0, matchScore: 0, gamePoints: 0, dealer: false, currentTurn: false },
      { id: "north", name: "Ti", seat: "NORTH", human: false, team: "Us", hand: [], handSize: 0, matchScore: 0, gamePoints: 0, dealer: false, currentTurn: false },
      { id: "east", name: "Istok", seat: "EAST", human: false, team: "Them", hand: [], handSize: 0, matchScore: 0, gamePoints: 0, dealer: true, currentTurn: false }
    ],
    trick: { leadPlayerId: null, cards: [] },
    score: {
      teamOneName: "Us",
      teamOneMatchScore: 0,
      teamOneGamePoints: 0,
      teamTwoName: "Them",
      teamTwoMatchScore: 0,
      teamTwoGamePoints: 0,
      declarerTeam: null,
      gameNumber: 0,
      difficulty: "NORMAL",
      matchTargetWins: 3,
      gameTargetPoints: 1001,
      teamOneMeldPoints: 0,
      teamTwoMeldPoints: 0,
      meldDeclarations: []
    },
    pendingAction: {
      type: "START_MATCH",
      actingPlayerId: "south",
      legalCardIndices: [],
      legalTrumpChoices: [],
      belaEligibleCardIndices: [],
      availableMelds: [],
      meldWinner: null,
      validationMessage: null,
      prompt: "Start the match."
    },
    lastEventSequence: 1,
    matchComplete: false
  }
};

test("temporary restore failures preserve the saved match and retry without creating another session", async () => {
  window.localStorage.setItem("belot-session-id", "saved-match");
  let offline = true;
  const saved = { ...baseSession, sessionId: "saved-match" };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (offline) throw new TypeError("Network unavailable");
    return { ok: true, json: async () => String(input).includes("/events") ? [] : saved };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  const retry = await screen.findByRole("button", { name: "Try again" });
  expect(window.localStorage.getItem("belot-session-id")).toBe("saved-match");
  expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/sessions")).toBe(false);
  offline = false;
  await userEvent.click(retry);
  expect(await screen.findByRole("button", { name: "Start the match" })).toBeEnabled();
  expect(window.localStorage.getItem("belot-session-id")).toBe("saved-match");
  expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/sessions")).toBe(false);
});

test("optional history failure does not discard a successfully restored session", async () => {
  window.localStorage.setItem("belot-session-id", "saved-match");
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("/events")) throw new TypeError("History unavailable");
    return { ok: true, json: async () => ({ ...baseSession, sessionId: "saved-match" }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(await screen.findByRole("button", { name: "Start the match" })).toBeEnabled();
  expect(window.localStorage.getItem("belot-session-id")).toBe("saved-match");
  expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/sessions")).toBe(false);
});

test("trump commands disable conflicting controls and submit only once while awaiting the server", async () => {
  window.localStorage.setItem("belot-session-id", "session-1");
  const choosing: SessionResponse = { ...baseSession, snapshot: { ...baseSession.snapshot,
    phase: "TRUMP_SELECTION", score: { ...baseSession.snapshot.score, gameNumber: 1 },
    pendingAction: { ...baseSession.snapshot.pendingAction, type: "CHOOSE_TRUMP", legalTrumpChoices: ["HEARTS", "SPADES", "SKIP"] }
  } };
  let finish!: (response: unknown) => void;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/trump")) return new Promise(resolve => { finish = resolve; });
    return { ok: true, json: async () => String(input).includes("/events") ? [] : choosing };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  const hearts = await screen.findByRole("button", { name: "hearts" });
  fireEvent.click(hearts);
  fireEvent.click(hearts);
  expect(hearts).toBeDisabled();
  expect(screen.getByRole("button", { name: "spades" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Quit match" })).toBeDisabled();
  expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/trump"))).toHaveLength(1);
  await act(async () => { finish({ ok: true, json: async () => choosing }); });
  await waitFor(() => expect(hearts).toBeEnabled());
});

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(globalThis, "EventSource", {
    configurable: true,
    writable: true,
    value: FakeEventSource
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("renders the table and terminal", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      json: async () => url.includes("/events") ? [] : baseSession
    };
  }));

  render(<App />);

  expect(await screen.findByRole("heading", { name: "Live game history" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Belot table" })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Start the match" })).toBeEnabled();
  expect(screen.getByPlaceholderText("Lionheart")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Alfred")).toBeInTheDocument();
  expect(screen.getAllByText("Zapad").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "easy" })).toBeEnabled();
  expect(screen.getAllByText(/us/i).length).toBeGreaterThan(0);
});

test("starts the match from the start button", async () => {
  const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => String(input).includes("/events") ? [] : baseSession
  }));
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  const startButton = await screen.findByRole("button", { name: "Start the match" });
  await userEvent.click(startButton);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/sessions/session-1/start",
    expect.objectContaining({ method: "POST" })
  ));
});

test("How to play starts the match and opens directly to the game guide", async () => {
  const startedSession: SessionResponse = {
    ...baseSession,
    snapshot: { ...baseSession.snapshot, phase: "TRUMP_SELECTION",
      pendingAction: { ...baseSession.snapshot.pendingAction, type: "CHOOSE_TRUMP", legalTrumpChoices: ["HEARTS", "SPADES"] } }
  };
  const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => String(input).includes("/events") ? [] : String(input).endsWith("/start") ? startedSession : baseSession
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "How to play" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/sessions/session-1/start", expect.objectContaining({ method: "POST" })
  ));
  const guide = await screen.findByRole("dialog", { name: "Brisnik Bela" });
  expect(within(guide).getByRole("button", { name: "Game guide" })).toHaveAttribute("aria-current", "page");
  expect(within(guide).getByRole("region", { name: "Game guide" })).toBeInTheDocument();
  await userEvent.click(within(guide).getByRole("button", { name: "Back to table" }));
  expect(screen.queryByRole("dialog", { name: "Brisnik Bela" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Choose the trump suit" })).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/start"))).toHaveLength(1);
});

test("quit match ends the current match and shows the match-complete popup", async () => {
  const activeSession: SessionResponse = {
    ...baseSession,
    snapshot: {
      ...baseSession.snapshot,
      phase: "TRICK_PLAY",
      currentPlayerId: "west",
      pendingAction: {
        type: "NONE",
        actingPlayerId: null,
        legalCardIndices: [],
        legalTrumpChoices: [],
        belaEligibleCardIndices: [],
        availableMelds: [],
        meldWinner: null,
        validationMessage: null,
        prompt: "Wait."
      }
    }
  };
  const matchCompleteSession: SessionResponse = {
    ...baseSession,
    snapshot: {
      ...baseSession.snapshot,
      phase: "MATCH_COMPLETE",
      matchComplete: true,
      score: {
        ...baseSession.snapshot.score,
        gameNumber: 3,
        teamOneMatchScore: 0,
        teamOneGamePoints: 744,
        teamTwoMatchScore: 3,
        teamTwoGamePoints: 1001
      },
      pendingAction: {
        type: "NONE",
        actingPlayerId: null,
        legalCardIndices: [],
        legalTrumpChoices: [],
        belaEligibleCardIndices: [],
        availableMelds: [],
        meldWinner: null,
        validationMessage: null,
        prompt: "Match complete."
      }
    }
  };

  const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/sessions/session-1/quit") || url === "/api/sessions/session-1/quit") {
      return { ok: true, json: async () => matchCompleteSession };
    }
    if (url.includes("/events")) {
      return {
        ok: true,
        json: async () => [
          {
            sequence: 10,
            type: "INFO",
            message: "Them won the game.",
            createdAt: "2026-03-13T12:00:00Z",
            payload: {
              eventKind: "GAME_WIN",
              winner: "Them",
              winningScore: "1001",
              matchWins: "3",
              byForfeit: "true"
            }
          },
          {
            sequence: 11,
            type: "INFO",
            message: "Them won the match.",
            createdAt: "2026-03-13T12:00:01Z",
            payload: {
              eventKind: "MATCH_WIN",
              winner: "Them",
              matchWins: "3",
              byForfeit: "true"
            }
          }
        ]
      };
    }
    return { ok: true, json: async () => activeSession };
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  const quitButton = await screen.findByRole("button", { name: "Quit match" });
  await userEvent.click(quitButton);
  const cancelledConfirmation = await screen.findByRole("dialog", { name: "Leave this match?" });
  await userEvent.click(within(cancelledConfirmation).getByRole("button", { name: "Keep playing" }));
  expect(screen.queryByRole("dialog", { name: "Leave this match?" })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/quit"))).toBe(false);
  await userEvent.click(quitButton);
  const confirmation = await screen.findByRole("dialog", { name: "Leave this match?" });
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/quit"))).toBe(false);
  await userEvent.click(within(confirmation).getByRole("button", { name: "Quit match" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/sessions/session-1/quit",
    expect.objectContaining({ method: "POST" })
  ));
  expect(await screen.findByRole("dialog", { name: "Match complete" })).toBeInTheDocument();
});

test("renders playable cards and disables unplayable cards", async () => {
  const playableSession: SessionResponse = {
    ...baseSession,
    snapshot: {
      ...baseSession.snapshot,
      phase: "TRICK_PLAY",
      pendingAction: {
        type: "PLAY_CARD",
        actingPlayerId: "south",
        legalCardIndices: [1],
        legalTrumpChoices: [],
        belaEligibleCardIndices: [],
        availableMelds: [],
        meldWinner: null,
        validationMessage: null,
        prompt: "Play a legal card."
      },
      players: [
        {
          ...baseSession.snapshot.players[0],
          hand: [
            { suit: "SPADES", rank: "ACE", label: "AS", faceUp: true, playable: false },
            { suit: "HEARTS", rank: "KING", label: "KH", faceUp: true, playable: true }
          ],
          handSize: 2,
          currentTurn: true
        },
        ...baseSession.snapshot.players.slice(1)
      ]
    }
  };

  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      json: async () => url.includes("/events") ? [] : playableSession
    };
  }));

  render(<App />);

  const blockedCard = await screen.findByRole("button", { name: /ace of spades/i });
  const playableCard = await screen.findByRole("button", { name: /king of hearts/i });
  expect(blockedCard).toBeDisabled();
  expect(playableCard).toBeEnabled();
});

test("renders trump suit options with lowercase labels", async () => {
  const trumpSession: SessionResponse = {
    ...baseSession,
    snapshot: {
      ...baseSession.snapshot,
      phase: "TRUMP_SELECTION",
      pendingAction: {
        type: "CHOOSE_TRUMP",
        actingPlayerId: "south",
        legalCardIndices: [],
        legalTrumpChoices: ["SPADES", "HEARTS", "DIAMONDS", "CLUBS", "SKIP"],
        belaEligibleCardIndices: [],
        availableMelds: [],
        meldWinner: null,
        validationMessage: null,
        prompt: "Choose the trump suit or skip."
      }
    }
  };

  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      json: async () => url.includes("/events") ? [] : trumpSession
    };
  }));

  render(<App />);

  expect(await screen.findByRole("button", { name: "hearts" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "clubs" })).toBeEnabled();
});

test("browser mode bootstraps without backend requests", async () => {
  vi.stubEnv("VITE_GAME_RUNTIME", "browser");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  await waitFor(() => expect(screen.getByRole("button", { name: "Start the match" })).toBeEnabled());
  expect(fetchMock).not.toHaveBeenCalled();
  expect(window.localStorage.getItem("belot-session-id")).toBeNull();
});

test("a missing browser session during subscription recovers without crashing the app", async () => {
  vi.stubEnv("VITE_GAME_RUNTIME", "browser");
  const { browserGateway } = await import("./lib/browserGateway");
  const subscription = vi.spyOn(browserGateway, "subscribe").mockImplementationOnce(() => {
    throw Object.assign(new Error("Session not found."), { code: "error.session" });
  });
  try {
    render(<App />);
    await waitFor(() => expect(subscription).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "Start the match" })).toBeEnabled();
    expect(screen.getByRole("region", { name: "Belot table" })).toBeInTheDocument();
  } finally {
    subscription.mockRestore();
  }
});

test("renders the winning team and its player melds", async () => {
  const meldWinnerSession: SessionResponse = {
    ...baseSession,
    snapshot: {
      ...baseSession.snapshot,
      phase: "MELD_REVIEW",
      pendingAction: {
        type: "ACKNOWLEDGE_MELDS",
        actingPlayerId: "south",
        legalCardIndices: [],
        legalTrumpChoices: [],
        belaEligibleCardIndices: [],
        availableMelds: [],
        meldWinner: {
          teamName: "Them",
          players: [
            {
              playerId: "east",
              playerName: "Istok",
              teamName: "Them",
              totalPoints: 50,
              melds: [
                {
                  kind: "SEQUENCE",
                  label: "Sequence of 4",
                  points: 50,
                  comparisonValue: 450,
                  cards: [
                    { suit: "HEARTS", rank: "NINE", label: "9H", faceUp: true, playable: false },
                    { suit: "HEARTS", rank: "TEN", label: "10H", faceUp: true, playable: false },
                    { suit: "HEARTS", rank: "JACK", label: "JH", faceUp: true, playable: false },
                    { suit: "HEARTS", rank: "QUEEN", label: "QH", faceUp: true, playable: false }
                  ]
                }
              ]
            }
          ]
        },
        validationMessage: null,
        prompt: "Review the melds and continue."
      }
    }
  };

  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      json: async () => url.includes("/events") ? [] : meldWinnerSession
    };
  }));

  render(<App />);

  const dialog = await screen.findByRole("dialog", { name: "Winning melds" });
  expect(dialog).toHaveTextContent("Winning teamThem");
  const player = within(dialog).getByRole("region", { name: "Istok" });
  expect(within(player).getByLabelText("50 points")).toBeInTheDocument();
  expect(player).toHaveTextContent("Sequence of 4");
  expect(within(player).getAllByRole("img", { name: /of hearts$/i })).toHaveLength(4);
});

test("renders a game-complete popup with the final score and match standing", async () => {
  const nextGameSession: SessionResponse = {
    ...baseSession,
    snapshot: {
      ...baseSession.snapshot,
      phase: "BETWEEN_GAMES",
      score: {
        ...baseSession.snapshot.score,
        gameNumber: 2,
        teamOneMatchScore: 0,
        teamOneGamePoints: 812,
        teamTwoMatchScore: 1,
        teamTwoGamePoints: 1001
      },
      pendingAction: {
        type: "START_NEXT_GAME",
        actingPlayerId: "south",
        legalCardIndices: [],
        legalTrumpChoices: [],
        belaEligibleCardIndices: [],
        availableMelds: [],
        meldWinner: null,
        validationMessage: null,
        prompt: "Start the next game."
      }
    }
  };

  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      json: async () =>
        url.includes("/events")
          ? [
              {
                sequence: 12,
                type: "INFO",
                message: "Them won the game.",
                createdAt: "2026-03-13T12:00:00Z",
                payload: {
                  eventKind: "GAME_WIN",
                  winner: "Them",
                  winningScore: "1001",
                  matchWins: "1",
                  byForfeit: "false"
                }
              }
            ]
          : nextGameSession
    };
  }));

  render(<App />);

  const dialog = await screen.findByRole("dialog", { name: "Game complete" });
  expect(dialog).toHaveTextContent("Them won the game.");
  expect(dialog).toHaveTextContent("Settings");
  expect(dialog).toHaveTextContent("Target wins: 3");
  expect(dialog).toHaveTextContent("1,001 points");
  expect(dialog).toHaveTextContent("Standings");
  expect(dialog).toHaveTextContent("1 wins · 1,001 points");
  expect(dialog).toHaveTextContent("0 wins · 812 points");
  expect(screen.getByRole("button", { name: "Deal the next game" })).toBeEnabled();
});

test("renders a match-complete popup with rematch and settings actions", async () => {
  const matchCompleteSession: SessionResponse = {
    ...baseSession,
    snapshot: {
      ...baseSession.snapshot,
      phase: "MATCH_COMPLETE",
      matchComplete: true,
      score: {
        ...baseSession.snapshot.score,
        gameNumber: 4,
        teamOneMatchScore: 1,
        teamOneGamePoints: 854,
        teamTwoMatchScore: 3,
        teamTwoGamePoints: 1001
      },
      pendingAction: {
        type: "NONE",
        actingPlayerId: null,
        legalCardIndices: [],
        legalTrumpChoices: [],
        belaEligibleCardIndices: [],
        availableMelds: [],
        meldWinner: null,
        validationMessage: null,
        prompt: "Match complete."
      }
    }
  };

  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      json: async () =>
        url.includes("/events")
          ? [
              {
                sequence: 20,
                type: "INFO",
                message: "Them won the game.",
                createdAt: "2026-03-13T12:00:00Z",
                payload: {
                  eventKind: "GAME_WIN",
                  winner: "Them",
                  winningScore: "1001",
                  matchWins: "3",
                  byForfeit: "false"
                }
              },
              {
                sequence: 21,
                type: "INFO",
                message: "Them won the match.",
                createdAt: "2026-03-13T12:00:01Z",
                payload: {
                  eventKind: "MATCH_WIN",
                  winner: "Them",
                  matchWins: "3",
                  byForfeit: "false"
                }
              }
            ]
          : matchCompleteSession
    };
  }));

  render(<App />);

  const dialog = await screen.findByRole("dialog", { name: "Match complete" });
  expect(dialog).toHaveTextContent("Them won the match 3–1.");
  const scoreboard = within(dialog).getByRole("group", { name: "Final match score" });
  expect(within(scoreboard).getByRole("group", { name: "Them" })).toHaveTextContent("Match winnerThem3Games won");
  expect(within(scoreboard).getByRole("group", { name: "Us" })).toHaveTextContent("Runner-upUs1Games won");
  expect(within(dialog).getByText("1,001–854")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rematch" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function cardPlayFixture() {
  const card = { suit: "HEARTS", rank: "ACE", label: "AH", faceUp: true, playable: true };
  const before: SessionResponse = { ...baseSession, snapshot: { ...baseSession.snapshot,
    phase: "TRICK_PLAY", trumpSuit: "HEARTS", lastEventSequence: 1,
    players: baseSession.snapshot.players.map(p => p.seat === "SOUTH" ? { ...p, hand: [card], handSize: 1, currentTurn: true } : p),
    pendingAction: { ...baseSession.snapshot.pendingAction, type: "PLAY_CARD", legalCardIndices: [0] }
  } };
  const played = { seat: "SOUTH" as const, playerId: "south", playerName: "You", card: { ...card, playable: false } };
  const after: SessionResponse = { ...before, snapshot: { ...before.snapshot, lastEventSequence: 2,
    players: before.snapshot.players.map(p => p.seat === "SOUTH" ? { ...p, hand: [], handSize: 0 } : p),
    trick: { leadPlayerId: "south", cards: [played] }
  } };
  const history: GameEvent[] = [{ sequence: 2, type: "ACTION", message: "You played AH.", createdAt: "2026-10-23T12:00:00Z",
    payload: { eventKind: "PLAY_CARD", playerId: "south", playerSeat: "SOUTH", playerName: "You", card: "AH", rank: "ACE", suit: "HEARTS" } }];
  return { before, after, history };
}

test("a saved imported deck is fully prepared before the first hand or its trick animation paints", async () => {
  const { before, after, history } = cardPlayFixture();
  localStorage.setItem("belot-preferences-v1", JSON.stringify({ version: 1, visual: { cardStyle: "french" } }));
  const images: { onload: (() => void) | null; finishDecode: () => void }[] = [];
  vi.stubGlobal("Image", class {
    src = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    finishDecode!: () => void;
    decode = () => new Promise<void>(resolve => { this.finishDecode = resolve; });
    constructor() { images.push(this); }
  });
  let played = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/card")) { played = true; return { ok: true, json: async () => after }; }
    return { ok: true, json: async () => url.includes("/events") ? played ? history : [] : before };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(images).toHaveLength(33);
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
  await act(async () => {
    images.forEach(image => image.onload?.());
    images.slice(0, -1).forEach(image => image.finishDecode());
  });
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
  await act(async () => { images.at(-1)!.finishDecode(); });
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  expect(card).toHaveAttribute("data-card-style", "french");
  expect(card.querySelector(".playing-card-corner")).not.toBeInTheDocument();
  expect(card.querySelector(".playing-card-imported-art")).toBeInTheDocument();
  await userEvent.click(card);
  const trickCard = await screen.findByRole("img", { name: "You: ace of hearts" });
  expect(trickCard).toHaveAttribute("data-card-style", "french");
  expect(trickCard.querySelector(".playing-card-corner")).not.toBeInTheDocument();
  expect(trickCard.querySelector(".playing-card-imported-art")).toHaveAttribute("decoding", "sync");
});

test("starting during a deck change waits for that deck while the previous artwork stays intact", async () => {
  const { before } = cardPlayFixture();
  const images: { onload: (() => void) | null; finishDecode: () => void }[] = [];
  vi.stubGlobal("Image", class {
    src = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    finishDecode!: () => void;
    decode = () => new Promise<void>(resolve => { this.finishDecode = resolve; });
    constructor() { images.push(this); }
  });
  let started = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/start")) started = true;
    return { ok: true, json: async () => url.includes("/events") ? [] : started ? before : baseSession };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await screen.findByRole("button", { name: "Start the match" });
  // Prepare the first chosen deck, then leave its replacement loading.
  await userEvent.click(screen.getByRole("button", { name: "Next card style" }));
  await act(async () => {
    images.forEach(image => { image.onload?.(); image.finishDecode(); });
  });
  images.length = 0;
  await userEvent.click(screen.getByRole("button", { name: "Next card style" }));
  expect(images).toHaveLength(33);
  expect(document.documentElement).toHaveAttribute("data-card-style", "french");
  await userEvent.click(screen.getByRole("button", { name: "Start the match" }));
  expect(started).toBe(false);
  expect(document.querySelectorAll('.playing-card-face[data-card-style="italian"]')).toHaveLength(0);
  await act(async () => {
    images.forEach(image => { image.onload?.(); image.finishDecode(); });
  });
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  expect(started).toBe(true);
  expect(card).toHaveAttribute("data-card-style", "italian");
  expect(card.querySelector(".playing-card-center,.playing-card-corner")).not.toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute("data-card-style", "italian");
});

test("persists both playback controls and restores them after mounting again", async () => {
  const { before } = cardPlayFixture();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
    ok: true, json: async () => String(input).includes("/events") ? [] : before
  })));
  const first = render(<App />);
  await screen.findByRole("button", { name: "ace of hearts" });
  await userEvent.click(screen.getByRole("button", { name: "Skip animations" }));
  await userEvent.click(screen.getByRole("button", { name: "Fast speed" }));
  expect(screen.getByRole("button", { name: "Skip animations" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Fast speed" })).toHaveTextContent("2×");
  expect(JSON.parse(localStorage.getItem("belot-preferences-v1")!).playback).toEqual({ skipAnimations: true, speed: "fast" });
  first.unmount();
  render(<App />);
  await screen.findByRole("button", { name: "ace of hearts" });
  expect(screen.getByRole("button", { name: "Skip animations" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Fast speed" })).toHaveAttribute("aria-pressed", "true");
  expect(document.documentElement).toHaveAttribute("data-skip-animations", "true");
});

test("skips an active sequence immediately and never replays its old timers", async () => {
  const { before, after, history } = cardPlayFixture();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
    ok: true, json: async () => String(input).includes("/events") ? history : String(input).endsWith("/card") ? after : before
  })));
  render(<App />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  vi.useFakeTimers();
  fireEvent.click(card);
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.selectionMs); });
  expect(document.querySelector(".trick-cards-animated")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Skip animations" }));
  expect(document.querySelector(".trick-cards-animated")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Skip animations" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(document.querySelector(".trick-cards-animated")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
});

test("changes an in-flight play and the following pause to fast speed without restarting", async () => {
  const { before, after, history } = cardPlayFixture();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
    ok: true, json: async () => String(input).includes("/events") ? history : String(input).endsWith("/card") ? after : before
  })));
  render(<App />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  vi.useFakeTimers();
  fireEvent.click(card);
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.selectionMs + CARD_TIMING.leadPlayMs / 2); });
  fireEvent.click(screen.getByRole("button", { name: "Fast speed" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.leadPlayMs / 4 - 1); });
  expect(document.querySelector(".trick-points-chip")).toHaveTextContent("0");
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(document.querySelector(".trick-points-chip")).toHaveTextContent("11");
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.unfinishedTrickHoldMs / 2 - 1); });
  expect(document.querySelector(".trick-cards-animated")).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(document.querySelector(".trick-cards-animated")).not.toBeInTheDocument();
});

test("skips the selection delay immediately once a play has been accepted", async () => {
  const { before, after, history } = cardPlayFixture();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
    ok: true, json: async () => String(input).includes("/events") ? history : String(input).endsWith("/card") ? after : before
  })));
  render(<App />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  vi.useFakeTimers();
  fireEvent.click(card);
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
  expect(screen.getByRole("button", { name: "ace of hearts" })).toBe(card);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Skip animations" })); });
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
  expect(document.querySelector(".trick-cards-animated")).not.toBeInTheDocument();
});

test("changes speed during selection without restarting its delay", async () => {
  const { before, after, history } = cardPlayFixture();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
    ok: true, json: async () => String(input).includes("/events") ? history : String(input).endsWith("/card") ? after : before
  })));
  render(<App />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  vi.useFakeTimers();
  fireEvent.click(card);
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.selectionMs / 2); });
  fireEvent.click(screen.getByRole("button", { name: "Fast speed" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.selectionMs / 4 - 1); });
  expect(screen.getByRole("button", { name: "ace of hearts" })).toBe(card);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
  expect(document.querySelector(".phase-placing")).toBeInTheDocument();
});

test("plays directly to the confirmed state when animation skipping is already enabled", async () => {
  const { before, after, history } = cardPlayFixture();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
    ok: true, json: async () => String(input).includes("/events") ? history : String(input).endsWith("/card") ? after : before
  })));
  render(<App />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  await userEvent.click(screen.getByRole("button", { name: "Skip animations" }));
  await userEvent.click(card);
  await waitFor(() => expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument());
  expect(document.querySelector(".trick-cards-animated")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
});

test("holds the full trick, clears it for the complete rest, then starts the queued lead without revealing the old snapshot", async () => {
  const { before, after, history } = cardPlayFixture();
  const baseCards = (["WEST", "NORTH", "EAST"] as const).map((seat, index) => ({
    seat, playerId: seat.toLowerCase(), playerName: seat,
    card: { suit: "HEARTS", rank: ["JACK", "TEN", "KING"][index], label: ["JH", "10H", "KH"][index], faceUp: true, playable: false }
  }));
  before.snapshot.trick = { cards: baseCards, leadPlayerId: "west" };
  const nextCard = { ...baseCards[0], card: { ...baseCards[0].card, rank: "SEVEN", label: "7H" } };
  after.snapshot.lastEventSequence = 4;
  after.snapshot.trick = { cards: [nextCard], leadPlayerId: "west" };
  history.push({ ...history[0], sequence: 3, payload: { eventKind: "TRICK_WIN", winnerSeat: "WEST", winnerPlayerId: "west", trickPoints: "45" } });
  history.push({ ...history[0], sequence: 4, payload: { eventKind: "PLAY_CARD", playerSeat: "WEST", playerId: "west", playerName: "WEST", card: "7H", suit: "HEARTS", rank: "SEVEN" } });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
    ok: true, json: async () => String(input).includes("/events") ? history : String(input).endsWith("/card") ? after : before
  })));
  render(<App />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  vi.useFakeTimers();
  fireEvent.click(card);
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.selectionMs); });
  expect(document.querySelectorAll(".trick-card-stack")).toHaveLength(4);
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.leadPlayMs); });
  expect(document.querySelector(".phase-highlight")).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.completedTrickHoldMs - 1); });
  expect(document.querySelector(".phase-highlight")).toBeInTheDocument();
  expect(document.querySelectorAll(".trick-card-stack")).toHaveLength(4);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(document.querySelector(".phase-collecting")).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.collectionMs); });
  expect(document.querySelector(".phase-resting")).toBeInTheDocument();
  expect(document.querySelectorAll(".trick-card-stack")).toHaveLength(0);
  expect(document.querySelector(".trick-points-chip")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Forfeit game" })).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.clearTableRestMs - 1); });
  expect(document.querySelectorAll(".trick-card-stack")).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(document.querySelector(".phase-placing")).toBeInTheDocument();
  expect(document.querySelectorAll(".trick-card-stack")).toHaveLength(1);
  expect(screen.getByRole("img", { name: "WEST: seven of hearts" })).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(CARD_TIMING.leadPlayMs + CARD_TIMING.unfinishedTrickHoldMs); });
  expect(document.querySelector(".trick-cards-animated")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "WEST: seven of hearts" })).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "You: ace of hearts" })).not.toBeInTheDocument();
});

test("keeps the selected face mounted through delayed play and event requests, then hands it directly to the trick", async () => {
  const { before, after, history } = cardPlayFixture();
  const play = deferred<Response>(), events = deferred<Response>();
  let played = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/card")) { played = true; return play.promise; }
    if (url.includes("/events")) return played ? events.promise : { ok: true, json: async () => [] };
    return { ok: true, json: async () => before };
  }));
  render(<App />);
  const handCard = await screen.findByRole("button", { name: "ace of hearts" });
  await userEvent.click(handCard);
  await act(async () => { await new Promise(r => setTimeout(r, 200)); });
  expect(screen.getByRole("button", { name: "ace of hearts" })).toBe(handCard);
  await act(async () => { play.resolve({ ok: true, json: async () => after } as Response); });
  expect(screen.getByRole("button", { name: "ace of hearts" })).toBe(handCard);
  await act(async () => { events.resolve({ ok: true, json: async () => history } as Response); });
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
  expect(document.querySelector(".play-enter")).not.toBeInTheDocument();
});

test("a rejected play leaves the same hand card visible and usable", async () => {
  const { before } = cardPlayFixture();
  const play = deferred<Response>();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/card")) return play.promise;
    return { ok: true, json: async () => url.includes("/events") ? [] : before };
  }));
  render(<App />);
  const card = await screen.findByRole("button", { name: "ace of hearts" });
  await userEvent.click(card);
  await act(async () => { await new Promise(r => setTimeout(r, 200)); });
  expect(screen.getByRole("button", { name: "ace of hearts" })).toBe(card);
  await act(async () => { play.reject(new Error("temporary network error")); });
  expect(screen.getByRole("button", { name: "ace of hearts" })).toBe(card);
  expect(card).toBeEnabled();
});

test("commits the accepted play when history is unavailable instead of restoring the played card", async () => {
  const { before, after } = cardPlayFixture();
  let played = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/card")) { played = true; return { ok: true, json: async () => after }; }
    if (url.includes("/events")) { if (played) throw new Error("history unavailable"); return { ok: true, json: async () => [] }; }
    return { ok: true, json: async () => before };
  }));
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "ace of hearts" }));
  expect(await screen.findByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
});

test("keeps the confirmed trick visible while a post-animation refresh is delayed", async () => {
  const { before, after, history } = cardPlayFixture();
  const refresh = deferred<Response>();
  let played = false, refreshing = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/card")) { played = true; return { ok: true, json: async () => after }; }
    if (url.includes("/events")) return { ok: true, json: async () => played ? history : [] };
    if (url.endsWith("/session-1") && played) { refreshing = true; return refresh.promise; }
    return { ok: true, json: async () => before };
  }));
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "ace of hearts" }));
  act(() => { FakeEventSource.latest.onmessage?.({ data: JSON.stringify(history[0]) } as MessageEvent<string>); });
  await waitFor(() => expect(refreshing).toBe(true), { timeout: 1800 });
  expect(screen.getByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
  await act(async () => { refresh.resolve({ ok: true, json: async () => before } as Response); });
  expect(screen.getByRole("img", { name: "You: ace of hearts" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
});

test("a missing session during play opens the fresh table instead of leaving the pending hand blank", async () => {
  const { before } = cardPlayFixture();
  let expired = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/card")) { expired = true; return { ok: false, status: 404, json: async () => ({ code: "SESSION_NOT_FOUND" }) }; }
    if (url.includes("/events")) return { ok: true, json: async () => [] };
    return { ok: true, json: async () => expired ? { ...baseSession, sessionId: "fresh-session" } : before };
  }));
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "ace of hearts" }));
  expect(await screen.findByRole("button", { name: "Start the match" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "ace of hearts" })).not.toBeInTheDocument();
});
