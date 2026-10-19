import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { setLanguage } from "../i18n";
import type { ComponentProps } from "react";
import ActionPanel from "./ActionPanel";

afterEach(() => { setLanguage("en"); localStorage.clear(); });

function resultProps(): ComponentProps<typeof ActionPanel> {
  return {
    errorMessage: null,
    playerNames: { SOUTH: "", NORTH: "", WEST: "", EAST: "" },
    teamNames: { yourTeam: "", enemyTeam: "" },
    gameSettings: { difficulty: "NORMAL", matchTargetWins: 3, gameLength: "LONG", tableTheme: "DARK_BLUE" },
    gameCompleteSummary: null,
    matchCompleteSummary: {
      winnerName: "Midnight Aces", loserName: "Trump Royals", winnerMatchWins: 3, loserMatchWins: 1,
      matchTargetWins: 3, finalGameWinnerPoints: 1001, finalGameLoserPoints: 854,
      finalGameByForfeit: false, gameNumber: 4
    },
    onPlayerNameChange: vi.fn(), onTeamNameChange: vi.fn(), onGameSettingsChange: vi.fn(),
    onStart: vi.fn(), onStartRematch: vi.fn(), onOpenSettingsMenu: vi.fn(), onChooseTrump: vi.fn(),
    onReportMelds: vi.fn(), onAcknowledgeMelds: vi.fn(), pendingBelaChoiceCard: null,
    onPlayWithBela: vi.fn(), onPlayWithoutBela: vi.fn()
  };
}

test("keeps each final score with its team and exposes the result details", () => {
  const props = resultProps();
  props.matchCompleteSummary!.winnerName = "A very long winning team name";
  render(<ActionPanel {...props} />);
  const score = screen.getByRole("group", { name: "Final match score" });
  const winner = within(score).getByRole("group", { name: "A very long winning team name" });
  expect(winner).toHaveTextContent("Match winnerA very long winning team name3Games won");
  expect(within(score).getByRole("group", { name: "Trump Royals" })).toHaveTextContent("Runner-upTrump Royals1Games won");
  expect(screen.getByText("1,001–854")).toBeInTheDocument();
  expect(screen.queryByText("By forfeit")).not.toBeInTheDocument();
});

test("shows forfeit separately and localizes result labels and numbers", () => {
  setLanguage("de");
  const props = resultProps();
  props.matchCompleteSummary!.finalGameByForfeit = true;
  const { rerender } = render(<ActionPanel {...props} />);
  expect(screen.getByRole("dialog", { name: "Match beendet" })).toBeInTheDocument();
  expect(screen.getByText("1.001–854")).toBeInTheDocument();
  expect(screen.getByText("Durch Aufgabe")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revanche" })).toBeEnabled();
  act(() => setLanguage("hr"));
  rerender(<ActionPanel {...props} />);
  expect(screen.getByText("Pobjednik meča")).toBeInTheDocument();
  expect(screen.getByText("Predajom")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revanš" })).toBeEnabled();
});

test("settings and rematch invoke their separate actions", async () => {
  const props = resultProps();
  const user = userEvent.setup();
  render(<ActionPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(props.onOpenSettingsMenu).toHaveBeenCalledOnce();
  expect(props.onStartRematch).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Rematch" }));
  expect(props.onStartRematch).toHaveBeenCalledOnce();
});
