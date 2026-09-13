import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { countText, getLocale, resolveLocale, setLanguage, t } from ".";
import { messages } from "./catalog";
import { cardDescription, errorCode, errorDescription, eventDescription } from "./presentation";
import LanguageSelect from "../components/LanguageSelect";
import { BelotMatchFacade } from "../lib/local-game/belotMatchFacade";
import { SeededRandom } from "../lib/local-game/random";

afterEach(() => { cleanup(); vi.restoreAllMocks(); setLanguage("en"); localStorage.removeItem("belot-language"); });

describe("localization", () => {
  test("honors explicit choices, ordered regional languages, and safe fallback", () => {
    expect(resolveLocale("hr", ["de-DE"])).toBe("hr");
    expect(resolveLocale("auto", ["fr-FR", "de-AT", "hr-HR"])).toBe("de");
    expect(resolveLocale(null, ["en-GB", "hr"])).toBe("en");
    expect(resolveLocale("invalid", ["bad_tag", "hr-HR"])).toBe("hr");
    expect(resolveLocale(null, [])).toBe("en");
    expect(resolveLocale(null, ["it-IT"])).toBe("en");
  });

  test("selector changes language and persists without losing focus", () => {
    render(<LanguageSelect />);
    const select = screen.getByRole("combobox");
    select.focus();
    fireEvent.change(select, { target: { value: "de" } });
    expect(document.documentElement.lang).toBe("de");
    expect(document.title).toBe("Belot-Tisch");
    expect(screen.getByLabelText("Sprache")).toBe(select);
    expect(select).toHaveFocus();
    expect(localStorage.getItem("belot-language")).toBe("de");
    expect(resolveLocale(localStorage.getItem("belot-language"), ["hr"])).toBe("de");
  });

  test("automatic mode follows browser changes, but explicit selection does not", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["hr-HR"]);
    setLanguage("auto");
    expect(getLocale()).toBe("hr");
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["de-CH"]);
    window.dispatchEvent(new Event("languagechange"));
    expect(getLocale()).toBe("de");
    setLanguage("en");
    window.dispatchEvent(new Event("languagechange"));
    expect(getLocale()).toBe("en");
  });

  test("blocked preference storage does not block switching", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    expect(() => setLanguage("hr")).not.toThrow();
    expect(getLocale()).toBe("hr");
  });

  test("catalogs preserve interpolation arguments and Unicode, with Croatian count forms", () => {
    for (const values of Object.values(messages)) {
      const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      for (const value of values) {
        expect(value.length).toBeGreaterThan(0);
        expect(placeholders(value)).toEqual(placeholders(values[0]));
        expect(value).not.toMatch(/[\p{L}]\?[\p{L}]/u);
      }
    }
    setLanguage("hr");
    expect(t("Start the match")).toBe("Započni meč");
    expect(countText("cards", 1)).toBe("1 karta");
    expect(countText("cards", 2)).toBe("2 karte");
    expect(countText("cards", 5)).toBe("5 karata");
    expect(countText("cards", 11)).toBe("11 karata");
    expect(countText("cards", 22)).toBe("22 karte");
  });

  test("switching rerenders event descriptions without altering cards, names, or game state", () => {
    const game = new BelotMatchFacade(new SeededRandom(7));
    game.updatePlayerNames({ SOUTH: "Deutsch <player>" });
    game.startMatch();
    const before = game.getSnapshot();
    const events = game.getEventsAfter(0);
    const start = events.find(event => event.payload.eventKind === "GAME_START")!;
    const english = eventDescription(start);
    act(() => setLanguage("hr"));
    expect(eventDescription(start)).not.toBe(english);
    expect(game.getSnapshot()).toEqual(before);
    expect(game.getEventsAfter(0)).toEqual(events);
    expect(cardDescription({ faceUp: true, rank: "JACK", suit: "HEARTS" })).toBe("Dečko · Herc");
  });

  test("engine rejection codes and snapshot validation localize without parsing English", () => {
    const game = new BelotMatchFacade(new SeededRandom(7));
    let failure: unknown;
    try { game.playCard(0); } catch (error) { failure = error; }
    expect(errorCode(failure)).toBe("UNEXPECTED_ACTION");
    expect(game.getSnapshot().pendingAction.validationCode).toBe("UNEXPECTED_ACTION");
    setLanguage("de");
    expect(errorDescription(errorCode(failure))).toBe("Diese Aktion ist jetzt nicht möglich.");
    expect(errorDescription("FUTURE_ERROR")).toBe(t("error.unknown"));
  });
});
