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

test("keeps both Bela choices usable with the selected card in the shared compact popup", async () => {
  const props = resultProps();
  props.matchCompleteSummary = null;
  props.pendingBelaChoiceCard = { rank: "QUEEN", suit: "SPADES", label: "QUEEN_SPADES", faceUp: true, playable: true };
  render(<ActionPanel {...props} />);
  const dialog = screen.getByRole("dialog", { name: "Bela" });
  expect(dialog).toHaveClass("belot-dialog-bela", "belot-dialog-floating-actions");
  expect(within(dialog).getAllByRole("img")).toHaveLength(1);
  const user = userEvent.setup();
  await user.click(within(dialog).getByRole("button", { name: "Play only" }));
  expect(props.onPlayWithoutBela).toHaveBeenCalledOnce();
  expect(props.onPlayWithBela).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole("button", { name: "Play + Bela" }));
  expect(props.onPlayWithBela).toHaveBeenCalledOnce();
});

test("keeps the partnership total and each player's evidence distinct in a shared meld review", () => {
  const props = resultProps();
  props.matchCompleteSummary = null;
  props.yourTeamName = "Your team";
  const teamName = "A long winning partnership name";
  const players = ["Jelačić", "Maximilian Aleksandar Zvonimir"].map((playerName, index) => ({
    playerId: `player-${index}`, playerName, teamName, totalPoints: index ? 50 : 20,
    melds: [{ kind: "SEQUENCE", label: `Sequence of ${index ? 4 : 3}`, points: index ? 50 : 20, comparisonValue: 3,
      cards: ["JACK", "QUEEN", "KING", "ACE"].slice(0, index ? 4 : 3).map(rank => ({
        rank, suit: "DIAMONDS", label: `${rank}_DIAMONDS`, faceUp: true, playable: false
      })) }]
  }));
  props.pendingAction = {
    type: "ACKNOWLEDGE_MELDS", actingPlayerId: "SOUTH", legalCardIndices: [], legalTrumpChoices: [],
    belaEligibleCardIndices: [], availableMelds: [], meldWinner: { teamName, players },
    validationMessage: null, prompt: ""
  };
  render(<ActionPanel {...props} />);
  const dialog = screen.getByRole("dialog", { name: "Winning melds" });
  const total = within(dialog).getByLabelText("70 points");
  expect(total.closest("[data-team]")).toHaveAttribute("data-team", "opponent");
  expect(total.parentElement).toHaveTextContent(teamName);
  for (const [index, player] of players.entries()) {
    const region = within(dialog).getByRole("region", { name: player.playerName });
    expect(region).toHaveAttribute("data-team", "opponent");
    expect(within(region).getByLabelText(`${player.totalPoints} points`)).toBeInTheDocument();
    expect(within(region).getAllByRole("img")).toHaveLength(index ? 4 : 3);
  }
});

test.each([true, false])("keeps trump choices usable without the redundant instruction (skip: %s)", async canSkip => {
  const props = resultProps();
  props.matchCompleteSummary = null;
  props.pendingAction = {
    type: "CHOOSE_TRUMP", actingPlayerId: "SOUTH", legalCardIndices: [],
    legalTrumpChoices: canSkip ? ["SKIP", "CLUBS", "DIAMONDS", "SPADES", "HEARTS"] : ["CLUBS", "DIAMONDS", "SPADES", "HEARTS"],
    belaEligibleCardIndices: [], availableMelds: [], meldWinner: null, validationMessage: null, prompt: ""
  };
  const previousOverflow = document.body.style.overflow;
  const { unmount } = render(<ActionPanel {...props} />);
  expect(document.body.style.overflow).toBe(previousOverflow);
  const dialog = screen.getByRole("dialog", { name: "Choose the trump suit" });
  expect(screen.queryByText("Choose the trump suit or skip.")).not.toBeInTheDocument();
  expect(screen.queryByText("Choose the trump suit.")).not.toBeInTheDocument();
  expect(dialog).not.toHaveAttribute("aria-describedby");
  const title = within(dialog).getByRole("heading");
  const choices = within(dialog).getAllByRole("button");
  expect(choices).toHaveLength(canSkip ? 5 : 4);
  expect(title.compareDocumentPosition(choices[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const user = userEvent.setup();
  await user.click(choices[0]);
  expect(props.onChooseTrump).toHaveBeenLastCalledWith("HEARTS");
  if (canSkip) {
    await user.click(choices.at(-1)!);
    expect(props.onChooseTrump).toHaveBeenLastCalledWith("SKIP");
  }
  unmount();
  expect(document.body.style.overflow).toBe(previousOverflow);
});

test("shows only meld evidence and awards while leaving the page unlocked for the visible hand", async () => {
  const props = resultProps();
  props.matchCompleteSummary = null;
  props.pendingAction = {
    type: "REPORT_MELDS", actingPlayerId: "SOUTH", legalCardIndices: [], legalTrumpChoices: [],
    belaEligibleCardIndices: [], meldWinner: null, validationMessage: null, prompt: "",
    availableMelds: [{ playerId: "SOUTH", playerName: "Tomislav", teamName: "High Command", totalPoints: 40,
      melds: ["HEARTS", "SPADES"].map(suit => ({ kind: "SEQUENCE", label: "Sequence of 3", points: 20, comparisonValue: 3,
        cards: ["JACK", "QUEEN", "KING"].map(rank => ({ suit, rank, label: `${rank}_${suit}`, faceUp: true, playable: false })) })) }]
  };
  const previousOverflow = document.body.style.overflow;
  render(<ActionPanel {...props} />);
  const dialog = screen.getByRole("dialog", { name: "Your melds" });
  expect(dialog).toHaveClass("belot-dialog-meld-choice");
  expect(document.body.style.overflow).toBe(previousOverflow);
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  expect(within(dialog).getAllByRole("img")).toHaveLength(6);
  expect(within(dialog).getAllByText("+20 points")).toHaveLength(2);
  expect(screen.queryByText("Tomislav")).not.toBeInTheDocument();
  expect(screen.queryByText("High Command")).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(within(dialog).getByRole("button", { name: "Pass" }));
  expect(props.onReportMelds).toHaveBeenLastCalledWith(false);
  await user.click(within(dialog).getByRole("button", { name: "Declare melds" }));
  expect(props.onReportMelds).toHaveBeenLastCalledWith(true);
});

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

test("keeps every card and award with its player when one teammate has two combinations", async () => {
  const props = resultProps();
  const combination = (suit: string) => ({ kind: "SEQUENCE", label: "Sequence of 3", points: 20, comparisonValue: 3,
    cards: ["SEVEN", "EIGHT", "NINE"].map(rank => ({ suit, rank, label: `${rank}_${suit}`, faceUp: true, playable: false })) });
  props.matchCompleteSummary = null;
  props.pendingAction = {
    type: "ACKNOWLEDGE_MELDS", actingPlayerId: null, legalCardIndices: [], legalTrumpChoices: [],
    belaEligibleCardIndices: [], availableMelds: [], validationMessage: null, prompt: "",
    meldWinner: { teamName: "High Command", players: [
      { playerId: "WEST", playerName: "Wellington", teamName: "High Command", totalPoints: 40,
        melds: [combination("SPADES"), combination("HEARTS")] },
      { playerId: "EAST", playerName: "Nelson", teamName: "High Command", totalPoints: 20, melds: [combination("CLUBS")] }
    ] }
  };
  render(<ActionPanel {...props} />);
  expect(screen.getByLabelText("60 points")).toBeInTheDocument();
  const first = within(screen.getByRole("region", { name: "Wellington" }));
  const second = within(screen.getByRole("region", { name: "Nelson" }));
  expect(first.getByLabelText("40 points")).toBeInTheDocument();
  expect(first.getAllByRole("img")).toHaveLength(6);
  expect(second.getAllByRole("img")).toHaveLength(3);
  expect(first.getAllByRole("region")).toHaveLength(2);
  expect(first.getAllByText("+20 points")).toHaveLength(2);
  await userEvent.setup().click(screen.getByRole("button", { name: "Continue" }));
  expect(props.onAcknowledgeMelds).toHaveBeenCalledOnce();
});
