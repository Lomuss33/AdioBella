import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { setLanguage } from "../i18n";
import ScoreBar from "./ScoreBar";

afterEach(() => setLanguage("en"));

test("trump and match details are one button, and clicking the trump row opens melds", async () => {
  setLanguage("en");
  render(<ScoreBar snapshot={null} errorMessage={null} />);
  const information = screen.getByRole("button", { name: /Meld details: Trump: Not chosen/ });
  expect(within(information).getByText("Trump")).toBeInTheDocument();
  expect(within(information).getByText("Not chosen")).toBeInTheDocument();
  expect(information.querySelector("button")).toBeNull();
  expect(information).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(within(information).getByText("Trump"));
  expect(screen.getByRole("dialog", { name: "Meld details" })).toBeInTheDocument();
  expect(information).toHaveAttribute("aria-expanded", "true");
});

test("Enter and Space open the details and closing restores focus to the whole button", async () => {
  setLanguage("en");
  render(<ScoreBar snapshot={null} errorMessage={null} />);
  const user = userEvent.setup();
  const information = screen.getByRole("button", { name: /Meld details:/ });
  await user.tab();
  expect(information).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("dialog", { name: "Meld details" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Back to table" }));
  expect(information).toHaveFocus();
  await user.keyboard(" ");
  expect(screen.getByRole("dialog", { name: "Meld details" })).toBeInTheDocument();
});

test("match controls stay separate from the information button", async () => {
  setLanguage("en");
  const quit = vi.fn();
  render(<ScoreBar snapshot={null} errorMessage={null} controls={<button onClick={quit}>Quit match</button>} />);
  const information = screen.getByRole("button", { name: /Meld details:/ });
  const control = screen.getByRole("button", { name: "Quit match" });
  expect(information.contains(control)).toBe(false);
  await userEvent.click(control);
  expect(quit).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
