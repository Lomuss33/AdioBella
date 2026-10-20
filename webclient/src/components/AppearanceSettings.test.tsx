import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { setLanguage } from "../i18n";
import { AccentColorPicker, TableColorPicker } from "./AppearanceSettings";

afterEach(() => setLanguage("en"));

test("offers eight named colors per palette and exposes selection without relying on color", async () => {
  setLanguage("en");
  const accentChange = vi.fn(), tableChange = vi.fn();
  render(<><AccentColorPicker value="bottle-green" onChange={accentChange} /><TableColorPicker value="PLUM" onChange={tableChange} /></>);
  const accents = within(screen.getByRole("group", { name: "Interface accent" }));
  const tables = within(screen.getByRole("group", { name: "table color" }));
  expect(accents.getAllByRole("button")).toHaveLength(8);
  expect(tables.getAllByRole("button")).toHaveLength(8);
  expect(accents.getByRole("button", { name: "Bottle green" })).toHaveAttribute("aria-pressed", "true");
  expect(tables.getByRole("button", { name: "Plum" })).toHaveAttribute("aria-pressed", "true");
  const user = userEvent.setup();
  await user.click(accents.getByRole("button", { name: "Oxblood" }));
  await user.click(tables.getByRole("button", { name: "Teal" }));
  expect(accentChange).toHaveBeenCalledWith("oxblood");
  expect(tableChange).toHaveBeenCalledWith("TEAL");
});

test("localizes the new colors in Croatian", () => {
  setLanguage("hr");
  render(<><AccentColorPicker value="oxblood" onChange={() => {}} /><TableColorPicker value="PLUM" onChange={() => {}} /></>);
  expect(within(screen.getByRole("group", { name: "Naglasak sučelja" })).getByRole("button", { name: "Bordo" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Šljiva" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Starinska mjed" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Petrolej" })).toBeInTheDocument();
});
