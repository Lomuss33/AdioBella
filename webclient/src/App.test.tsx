import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { SessionResponse } from "./types";

class FakeEventSource {
  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: (() => void) | null = null;

  constructor(_url: string) {}

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

  await waitFor(() => expect(screen.getByText("Game Terminal")).toBeInTheDocument());
  expect(screen.getByRole("status", { name: "Loading table" })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Start the match" })).toBeEnabled();
  expect(screen.getByDisplayValue("You")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Ti")).toBeInTheDocument();
  expect(screen.getAllByText("Zapad").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "easy" })).toBeEnabled();
  expect(screen.getAllByText(/us/i).length).toBeGreaterThan(0);
});

test("starts the match from the start button", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => baseSession })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...baseSession, snapshot: { ...baseSession.snapshot, phase: "TRUMP_SELECTION" } }) });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  const startButton = await screen.findByRole("button", { name: "Start the match" });
  await userEvent.click(startButton);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/sessions/session-1/start",
    expect.objectContaining({ method: "POST" })
  ));
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

  vi.spyOn(window, "confirm").mockReturnValue(true);
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

  const blockedCard = await screen.findByRole("button", { name: "as" });
  const playableCard = await screen.findByRole("button", { name: "kh" });
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

  expect(await screen.findByText("hearts")).toBeInTheDocument();
  expect(await screen.findByText("clubs")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "hearts" })).toBeEnabled();
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

test("renders meld winner popup with centered colon-separated details", async () => {
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

  const dialog = await screen.findByRole("dialog", { name: "Melds" });
  expect(dialog).toHaveTextContent("team : Them");
  expect(dialog).toHaveTextContent("player : Istok : 50");
  expect(dialog).toHaveTextContent("meld : sequence of 4");
  expect(screen.getAllByRole("button", { name: /^(9h|10h|jh|qh)$/i })).toHaveLength(4);
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
  expect(dialog).toHaveTextContent("First to 3 games");
  expect(dialog).toHaveTextContent("1001 points");
  expect(dialog).toHaveTextContent("Standings");
  expect(dialog).toHaveTextContent("1 MP · 1001 GP");
  expect(dialog).toHaveTextContent("0 MP · 812 GP");
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
  expect(dialog).toHaveTextContent("Them win the match 3-1.");
  expect(dialog).toHaveTextContent("Final game: 1001-854.");
  expect(screen.getByRole("button", { name: "Revenge" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled();
});
