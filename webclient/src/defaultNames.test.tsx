import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setLanguage } from "./i18n";
import { defaultNames } from "./i18n/defaultNames";
import { loadPreferences, PREFERENCES_KEY } from "./lib/preferences";
import { browserGateway } from "./lib/browserGateway";
import type { SessionResponse } from "./types";

beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
  vi.stubEnv("VITE_GAME_RUNTIME", "browser");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  setLanguage("en");
  localStorage.clear();
});

test("locale defaults reach gameplay while custom fields survive language changes and reloads", async () => {
  const update = vi.spyOn(browserGateway, "updateLobbySettings");
  const start = vi.spyOn(browserGateway, "startMatch");
  const view = render(<App />);
  await screen.findByRole("button", { name: "Start the match" });
  expect(screen.getByPlaceholderText("Maverick")).toHaveValue("");
  // Even a name that matches a default must remain a custom entry.
  await userEvent.type(screen.getByPlaceholderText("Ace"), "Ace");
  await userEvent.type(screen.getByPlaceholderText("Trump Royals"), "My Team");

  act(() => setLanguage("de"));
  await waitFor(() => expect(update).toHaveBeenLastCalledWith(expect.any(String), "NORMAL",
    { ...defaultNames.de.players, SOUTH: "Ace" },
    { ...defaultNames.de.teams, yourTeam: "My Team" }, 3, "LONG"));
  expect(screen.getByPlaceholderText("Fuchs")).toHaveValue("");
  expect(screen.getByDisplayValue("Ace")).toBeInTheDocument();

  act(() => setLanguage("hr"));
  await waitFor(() => expect(update).toHaveBeenLastCalledWith(expect.any(String), "NORMAL",
    { ...defaultNames.hr.players, SOUTH: "Ace" },
    { ...defaultNames.hr.teams, yourTeam: "My Team" }, 3, "LONG"));
  expect(loadPreferences().players.NORTH).toBe("");
  expect(loadPreferences().teams.yourTeam).toBe("My Team");

  view.unmount();
  render(<App />);
  const startButton = await screen.findByRole("button", { name: "Započni meč" });
  expect(screen.getByDisplayValue("Ace")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Majstor")).toHaveValue("");
  await userEvent.click(startButton);
  await waitFor(() => expect(start).toHaveBeenCalled());
  const response: SessionResponse = await start.mock.results[0].value;
  expect(response.snapshot.players.map(player => player.name)).toEqual(["Ace", "Sokol", "Majstor", "Vuk"]);
  expect(response.snapshot.score.teamOneName).toBe("My Team");
  expect(response.snapshot.score.teamTwoName).toBe("Noćni asovi");
});

test("keeps all previously saved names, including names that resemble old defaults", async () => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    version: 1, namesVersion: 2, players: { SOUTH: "You", NORTH: "Ti", WEST: "Zapad", EAST: "Istok" },
    teams: { yourTeam: "Us", enemyTeam: "Them" }
  }));
  setLanguage("de");
  render(<App />);
  expect(await screen.findByDisplayValue("Zapad")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Us")).toBeInTheDocument();
});


test("upgrades names incorrectly saved as custom by the first migration", async () => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    version: 1, namesVersion: 1,
    players: { SOUTH: "You", NORTH: "Ti", WEST: "Zapad", EAST: "Istok" },
    teams: { yourTeam: "Us", enemyTeam: "Them" }
  }));
  setLanguage("de");
  render(<App />);
  await screen.findByRole("button", { name: "Match starten" });
  expect(screen.queryByDisplayValue("Zapad")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Falke")).toHaveValue("");
  expect(screen.getByPlaceholderText("Trumpfkönige")).toHaveValue("");
  expect(loadPreferences().players.WEST).toBe("");
});
