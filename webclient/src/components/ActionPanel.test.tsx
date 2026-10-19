import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { setLanguage } from "../i18n";
import { useState, type ComponentProps } from "react";
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

test("capitalizes team and player word starts while preserving typed capitals and the editing caret", async () => {
  setLanguage("en");
  function Setup() {
    const props = resultProps();
    const [teams, setTeams] = useState(props.teamNames);
    const [players, setPlayers] = useState(props.playerNames);
    return <ActionPanel {...props} matchCompleteSummary={null}
      pendingAction={{ type: "START_MATCH", actingPlayerId: null, legalCardIndices: [], legalTrumpChoices: [], belaEligibleCardIndices: [], availableMelds: [], meldWinner: null, validationMessage: null, prompt: "" }}
      teamNames={teams} playerNames={players}
      onTeamNameChange={(team, value) => setTeams(current => ({ ...current, [team]: value }))}
      onPlayerNameChange={(seat, value) => setPlayers(current => ({ ...current, [seat]: value }))} />;
  }
  render(<Setup />);
  const user = userEvent.setup();
  const team = screen.getByRole("textbox", { name: "your team" }) as HTMLInputElement;
  await user.type(team, "high command");
  expect(team).toHaveValue("High Command");
  team.setSelectionRange(5, 5);
  await user.paste("royal ");
  expect(team).toHaveValue("High Royal Command");
  expect(team.selectionStart).toBe(11);
  await user.keyboard("of ");
  expect(team).toHaveValue("High Royal Of Command");
  const player = screen.getByRole("textbox", { name: "you" });
  await user.click(player);
  await user.paste("željko van McDONALD");
  expect(player).toHaveValue("Željko Van McDONALD");
  await user.clear(player);
  await user.type(player, "ALFRED the Great");
  expect(player).toHaveValue("ALFRED The Great");
  await user.clear(player);
  await user.type(player, "john");
  (player as HTMLInputElement).setSelectionRange(0, 1);
  await user.keyboard("{Backspace}");
  expect(player).toHaveValue("ohn");
  await user.keyboard("{End} smith");
  expect(player).toHaveValue("ohn Smith");
});

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

test("keeps the human team's identity when opponents win the match", () => {
  const props = resultProps();
  props.yourTeamName = "Trump Royals";
  render(<ActionPanel {...props} />);
  expect(screen.getByRole("group", { name: "Midnight Aces" })).toHaveAttribute("data-team", "opponent");
  expect(screen.getByRole("group", { name: "Trump Royals" })).toHaveAttribute("data-team", "your");
});

test("groups winning melds by player and keeps the team total distinct", async () => {
  const props = resultProps();
  props.matchCompleteSummary = null;
  props.pendingAction = {
    type: "ACKNOWLEDGE_MELDS", actingPlayerId: null, legalCardIndices: [], legalTrumpChoices: [],
    belaEligibleCardIndices: [], availableMelds: [], validationMessage: null, prompt: "",
    meldWinner: { teamName: "High Command", players: [
      { playerId: "WEST", playerName: "Wellington", teamName: "High Command", totalPoints: 50,
        melds: [{ kind: "SEQUENCE", label: "Sequence of 4", points: 50, comparisonValue: 4, cards: [] }] },
      { playerId: "EAST", playerName: "Nelson", teamName: "High Command", totalPoints: 20,
        melds: [{ kind: "SEQUENCE", label: "Sequence of 3", points: 20, comparisonValue: 3, cards: [] }] }
    ] }
  };
  render(<ActionPanel {...props} />);
  expect(screen.getByRole("dialog", { name: "Winning melds" })).toBeInTheDocument();
  expect(screen.getByText("Winning team")).toBeInTheDocument();
  expect(screen.getByLabelText("70 points")).toBeInTheDocument();
  const wellington = within(screen.getByRole("region", { name: "Wellington" }));
  expect(wellington.getByLabelText("50 points")).toBeInTheDocument();
  expect(wellington.getByText("Combinations")).toBeInTheDocument();
  expect(wellington.getByText("+50 points")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Nelson" })).getByText("+20 points")).toBeInTheDocument();
  expect(screen.queryByText("Combined points")).not.toBeInTheDocument();
  expect(screen.queryByText(/These are the winning team's melds/)).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Continue" }));
  expect(props.onAcknowledgeMelds).toHaveBeenCalledOnce();
});
