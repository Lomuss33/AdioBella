import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import GameRoot from "./GameRoot";
import { setLanguage } from "./i18n";
import { listSoloGames } from "./lib/soloGames";

afterEach(() => {
  cleanup();
  localStorage.clear();
  history.replaceState(null, "", "/");
});

test("starts, switches between, renames and deletes independent solo games", async () => {
  localStorage.clear();
  setLanguage("en");
  history.replaceState(null, "", "/");
  render(<GameRoot />);
  fireEvent.click(screen.getByRole("button", { name: /Singleplayer/ }));
  expect(screen.getByRole("heading", { name: "My games" })).toBeInTheDocument();
  const shortcuts = within(screen.getByRole("region", { name: "Solo game overview" })).getAllByRole("button");
  expect(shortcuts.map(button => button.getAttribute("aria-label") ?? button.textContent?.replace("+", "")))
    .toEqual(["Continue last game", "New game", "Continue recent game"]);
  expect(screen.getByRole("button", { name: "Continue last game" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Continue recent game" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: /New game/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Start the match" }));
  await screen.findByRole("button", { name: "hearts" });
  const first = listSoloGames()[0];
  expect(first.action).toBe("CHOOSE_TRUMP");
  fireEvent.click(screen.getByRole("button", { name: "My games" }));

  fireEvent.click(screen.getByRole("button", { name: /New game/ }));
  await screen.findByRole("button", { name: "Start the match" });
  await waitFor(() => expect(window.location.hash).not.toBe("#solo=new"));
  const second = listSoloGames().find(game => game.id !== first.id)!;
  expect(second.action).toBe("START_MATCH");
  const setup = screen.getByRole("dialog", { name: "Start the match" });
  fireEvent.click(within(setup).getByRole("button", { name: "My games" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue last game" }));
  await screen.findByRole("button", { name: "Start the match" });
  expect(window.location.hash).toBe(`#solo=${second.id}`);
  fireEvent.click(within(screen.getByRole("dialog", { name: "Start the match" })).getByRole("button", { name: "My games" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue recent game" }));
  await screen.findByRole("button", { name: "hearts" });
  expect(window.location.hash).toBe(`#solo=${first.id}`);
  fireEvent.click(screen.getByRole("button", { name: "My games" }));

  const firstRow = screen.getByText(/Choose trump/).closest("li")!;
  fireEvent.click(within(firstRow).getByRole("button", { name: "Rename" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Game name" }), { target: { value: "Weekend game" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  const named = within(screen.getByRole("list")).getByText("Weekend game").closest("li")!;
  fireEvent.click(within(named).getByRole("button", { name: "Continue" }));
  await screen.findByRole("button", { name: "hearts" });
  expect(listSoloGames()).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "My games" }));

  const row = within(screen.getByRole("list")).getByText("Weekend game").closest("li")!;
  fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
  expect(within(row).getByText("Delete this saved game?")).toBeInTheDocument();
  fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
  expect(listSoloGames().map(game => game.id)).toEqual([second.id]);
});
