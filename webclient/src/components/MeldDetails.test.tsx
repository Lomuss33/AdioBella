import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { setLanguage } from "../i18n";
import type { MeldDeclarationView } from "../types";
import MeldDetails from "./MeldDetails";

afterEach(() => setLanguage("en"));

const declaration: MeldDeclarationView = {
  playerId: "south", playerName: "Tomislav", teamName: "Guard", meldPoints: 20, belaPoints: 20,
  labels: ["Sequence of 3"],
  melds: [{ kind: "SEQUENCE", label: "Sequence of 3", points: 20, comparisonValue: 3,
    cards: ["JACK", "QUEEN", "KING"].map(rank => ({ rank, suit: "DIAMONDS", label: `${rank}_DIAMONDS`, faceUp: true, playable: false })) }]
};

test("shows the recorded card evidence, combined award and separate Bela points in the shared review panel", () => {
  render(<MeldDetails melds={[declaration]} yourTeam="Guard" onClose={vi.fn()} />);
  const player = screen.getByRole("region", { name: "Tomislav" });
  expect(player).toHaveAttribute("data-team", "your");
  expect(within(player).getAllByRole("img")).toHaveLength(3);
  expect(player.querySelector(".meld-player-total")).toHaveTextContent("40points");
  expect(within(player).getByText("Bela")).toBeInTheDocument();
  expect(within(player).getAllByText("+20 points")).toHaveLength(2);
});

test("keeps older text-only records and Bela-only declarations readable", () => {
  render(<MeldDetails melds={[
    { ...declaration, melds: undefined, belaPoints: 0 },
    { playerId: "west", playerName: "Zrinski", teamName: "Command", meldPoints: 0, belaPoints: 20, labels: [] }
  ]} yourTeam="Guard" onClose={vi.fn()} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText("Sequence of 3")).toBeInTheDocument();
  const opponent = screen.getByRole("region", { name: "Zrinski" });
  expect(opponent).toHaveAttribute("data-team", "opponent");
  expect(opponent.querySelector(".meld-player-total")).toHaveTextContent("20points");
  expect(within(opponent).getByText("+20 points")).toBeInTheDocument();
});

test("shows the empty state and supports both close controls and Escape", async () => {
  const onClose = vi.fn();
  render(<MeldDetails melds={[]} onClose={onClose} />);
  expect(screen.getByText("No declarations yet")).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Back to table" }));
  await user.click(screen.getByRole("button", { name: "Close meld details" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Meld details" }), { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(3);
});
