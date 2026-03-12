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
