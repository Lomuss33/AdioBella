import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { setLanguage } from "../i18n";
import { loadPlayerProfile, PLAYER_PROFILE_KEY } from "../lib/playerProfile";
import ProfilePage from "./ProfilePage";

beforeEach(() => {
  setLanguage("en");
  localStorage.removeItem(PLAYER_PROFILE_KEY);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(PLAYER_PROFILE_KEY);
});

test("previews edits, discards them, and saves the chosen identity", () => {
  render(<ProfilePage onBack={() => {}} />);
  const name = screen.getByRole("textbox", { name: "Table name" });
  const save = screen.getByRole("button", { name: "Save profile" });
  expect(save).toBeDisabled();

  fireEvent.change(name, { target: { value: "  Mira  " } });
  fireEvent.click(screen.getByRole("radio", { name: "hearts" }));
  expect(within(screen.getByRole("region", { name: "Profile preview" })).getByText("Mira")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(name).toHaveValue("");
  expect(screen.getByRole("radio", { name: "spades" })).toBeChecked();

  fireEvent.change(name, { target: { value: "  Mira  " } });
  fireEvent.click(screen.getByRole("radio", { name: "hearts" }));
  fireEvent.click(save);
  expect(screen.getByRole("status")).toHaveTextContent("Profile saved");
  expect(loadPlayerProfile()).toEqual({ name: "Mira", mark: "♥" });
  expect(save).toBeDisabled();
});

test("keeps unsaved edits available when storage fails", () => {
  render(<ProfilePage onBack={() => {}} />);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
  const name = screen.getByRole("textbox", { name: "Table name" });
  fireEvent.change(name, { target: { value: "Mira" } });
  const save = screen.getByRole("button", { name: "Save profile" });
  fireEvent.click(save);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
  expect(name).toHaveValue("Mira");
  expect(save).toBeEnabled();
});
