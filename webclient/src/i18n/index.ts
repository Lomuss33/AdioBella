import { useSyncExternalStore } from "react";
import { messages, type MessageKey } from "./catalog";
export type Locale = "en" | "de" | "hr";
export type LanguagePreference = Locale | "auto";
const STORAGE_KEY = "belot-language";
export function isPreference(value: unknown): value is LanguagePreference { return value === "auto" || value === "en" || value === "de" || value === "hr"; }
export function resolveLocale(preference: unknown, languages: readonly string[]): Locale {
  if (isPreference(preference) && preference !== "auto") return preference;
  for (const tag of languages) {
    try {
      const language = Intl.getCanonicalLocales(tag)[0]?.split("-")[0];
      if (language === "en" || language === "de" || language === "hr") return language;
    } catch { /* Ignore malformed browser settings. */ }
  }
  return "en";
}
function savedPreference(): LanguagePreference {
  try { const value = localStorage.getItem(STORAGE_KEY); return isPreference(value) ? value : "auto"; } catch { return "auto"; }
}
function browserLanguages() { return typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]; }
let preference = savedPreference();
let locale = resolveLocale(preference, browserLanguages());
let revision = 0;
const listeners = new Set<() => void>();
export const getLocale = () => locale;
function syncDocument() {
  if (typeof document !== "undefined") { document.documentElement.lang = locale; document.title = t("Belot Table"); }
}
function publish() { revision++; syncDocument(); listeners.forEach(listener => listener()); }
export function setLanguage(value: LanguagePreference) {
  if (!isPreference(value)) return;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("belot:before-language-change"));
  preference = value;
  locale = resolveLocale(value, browserLanguages());
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Current-tab selection still works. */ }
  publish();
}
export function useLanguage() {
  useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => revision, () => 0);
  return { locale, preference, setLanguage };
}
const browserLanguageChanged = () => {
  if (preference === "auto") setLanguage("auto");
};
if (typeof window !== "undefined") window.addEventListener("languagechange", browserLanguageChanged);
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener("languagechange", browserLanguageChanged));
type Args = Record<string, string | number>;
export function number(value: number) { return new Intl.NumberFormat(locale).format(value); }
export function t(key: MessageKey, args: Args = {}): string {
  const template = messages[key]?.[locale === "de" ? 1 : locale === "hr" ? 2 : 0] ?? messages[key]?.[0] ?? messages["error.unknown"][0];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => typeof args[name] === "number" ? number(args[name] as number) : String(args[name] ?? ""));
}
/** Translate known presentation labels only; never pass user names to this helper. */
export function tr(label: string): string { return Object.hasOwn(messages, label) ? t(label as MessageKey) : label; }
export function countText(kind: "cards" | "points" | "rounds" | "updates", count: number) {
  const category = new Intl.PluralRules(locale).select(count);
  const nouns = {
    en: { cards: ["card", "cards", "cards"], points: ["point", "points", "points"], rounds: ["trick", "tricks", "tricks"], updates: ["update", "updates", "updates"] },
    de: { cards: ["Karte", "Karten", "Karten"], points: ["Punkt", "Punkte", "Punkte"], rounds: ["Stich", "Stiche", "Stiche"], updates: ["Eintrag", "Einträge", "Einträge"] },
    hr: { cards: ["karta", "karte", "karata"], points: ["bod", "boda", "bodova"], rounds: ["štih", "štiha", "štihova"], updates: ["ažuriranje", "ažuriranja", "ažuriranja"] }
  };
  return `${number(count)} ${nouns[locale][kind][category === "one" ? 0 : category === "few" ? 1 : 2]}`;
}
syncDocument();
