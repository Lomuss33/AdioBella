# English, German, and Croatian localization plan

[Documentation index](README.md) ? [Architecture](architecture.md) ? [UI and UX plan](ui-ux-plan.md)

Status: implemented, with focused validation. Browser-first selection, explicit English/German/Croatian preferences, the starting-menu selector, localized components, structured runtime messages, error codes, meld descriptors, and responsive label handling are in source. Seven focused localization tests, the frontend build, the Pages build, and Java engine/server compilation passed. No full test suite, visual device sweep, or native-speaker translation review was performed.

## Implementation record

The implementation uses a small reactive external store (`src/i18n/index.ts`) subscribed to by App and locale-sensitive controls/history, rather than a provider wrapper. It resolves the browser language before rendering, synchronizes document language/title, guards storage, and handles automatic-mode browser language changes. Locale changes neither recreate the game gateway nor submit settings.

`catalog.ts` co-locates English, German, and Croatian entries in fixed tuples with typed message keys; static UI entries use stable source phrases and dynamic/domain entries use semantic keys. Named interpolation arguments are preserved across all three catalogs and checked in the focused test. Numeric/count formatting uses the selected locale and Croatian plural categories. `presentation.ts` formats cards, structured events, meld combinations, and stable errors. Brand names, printed rank letters, and stored player/team names are preserved. Existing default player names are treated as names; only role labels translate, avoiding unsafe default-name detection.

Both engines now add missing event kinds and actor/dealer/team facts. Meld declaration history carries optional structured combinations, and pending actions carry an optional validation code. Java retains legacy record constructors and English fallback fields. Server errors add a code alongside the existing error field; the browser facade attaches equivalent codes. Existing text-only meld history can fall back to its old labels. Unknown event codes use a translated generic label; legacy unstructured events retain their prose in English and use a generic localized label in other languages.

Verification covered preference priority, regional/unsupported languages, automatic versus explicit selection, storage failure, selector focus/persistence, catalog interpolation/Unicode, Croatian count forms, existing game/event preservation during switching, and localized engine rejection codes. The normal frontend build and Java compile passed during implementation; the final Pages build includes the last source and test type checks. Later terminology and device reviews remain useful and are not claimed here.

The original staged design below remains as rationale and future review guidance. Where it differs, this implementation record describes current behavior.

## Outcome and boundaries

The first visit automatically selects English, German, or Croatian from browser language preferences. The starting menu contains a compact language selector. An explicit choice takes effect immediately and survives page reloads. Automatic mode can be restored.

Localization covers the player-facing application: setup, table, all dialogs, card descriptions, scores, terminal/history, notifications, recoverable errors, accessibility labels, tooltips, and document title. Technical documentation, developer logs, source identifiers, URLs, and third-party browser messages are outside this pass. Keep the product name Belot unchanged.

Language is a client preference, separate from gameplay settings. It must not change difficulty, team membership, game rules, scores, card identities, random choices, session IDs, or theme. It must not recreate the gateway, restart a session, remount the game tree, replay animations, or submit lobby settings merely because the language changes.

## What source inspection found

| Area | Current situation | Required treatment |
| --- | --- | --- |
| React components | Visible strings are embedded throughout `ActionPanel`, `ScoreBar`, `GameDataCard`, `MatchDataCard`, confirmations, controls, and seats | Translate complete messages through one shared API |
| Terminal | `TerminalLog.tsx` renders `event.message` directly | Format structured events in the selected language at render time |
| Engines | Both Java and TypeScript create prompts, validation messages, meld labels, and event prose | Add matching language-neutral descriptors to both runtimes |
| Meld history | `MeldDeclarationView.labels` contains strings; combination views also include `kind`, points, and cards | Retain enough structured meld information to localize history after declaration |
| Errors | `App.tsx` stores many raw error strings; server handler returns an `error` string | Store error codes and arguments, then translate in the UI |
| Session recovery | `isMissingSessionError` includes an English message regex | Use a stable code/status; language must never drive recovery behavior |
| Cards | `cardPresentation.ts` mixes asset/class mapping with English presentation text | Keep identity and art stable; localize accessible descriptions separately |
| App identity | `index.html` starts with `lang="en"` and an English title | Resolve language before rendering and synchronize title/lang |
| Layout | Several controls use fixed widths and nowrap; status text clamps to two lines | Accommodate longer translations without breaking the fitted table |
| Runtime parity | Browser-only and Java-backed play share the UI but have independent rule implementations | Ship equivalent descriptor semantics in both implementations |

## Language selection contract

Use supported identifiers `en`, `de`, and `hr`, and a preference type `auto | en | de | hr`. Store the preference under a dedicated key, such as `belot-language`. Keep it independent of the saved theme and session keys.

Selection order:

1. Read and validate the saved preference. A saved supported language wins over browser settings.
2. If preference is missing, invalid, or `auto`, inspect `navigator.languages` in order, falling back to `navigator.language` if the list is unavailable or empty.
3. Normalize each well-formed tag, then match its primary language to a supported locale. Regional English, German, and Croatian tags map to their corresponding language. Skip malformed or unsupported entries and continue through the list.
4. Use English only if no supported preference is found.

Examples:

| Saved preference | Browser preference list | Result |
| --- | --- | --- |
| None | `de-AT, en-US` | German |
| None | `fr-FR, hr-HR, en` | Croatian |
| None | `en-GB, de` | English |
| `hr` | `de-DE, en` | Croatian |
| `auto` | `it-IT, de-CH` | German |
| Invalid value | `hr-HR` | Croatian |
| None | Unsupported or absent values | English |

Resolve synchronously before the first React render to avoid an English flash. Use guarded storage reads/writes: denied storage must not prevent startup or switching for the current tab. Persist only the chosen mode, not an automatic resolution that would later override the browser.

While in automatic mode, a browser `languagechange` notification re-resolves the supported language. Explicit choices remain fixed. Do not synchronize active tabs mid-match in this first version; saved choices apply to newly opened/reloaded tabs. Document that behavior. Do not infer language from location, IP, timezone, or keyboard layout.

## Starting-menu experience

Place a small, clearly labeled Language control near the starting dialog heading or alongside its general settings. Use a native select for predictable mobile interaction and compact sizing.

Options are `Automatic (browser)`, `English`, `Deutsch`, and `Hrvatski`. Language names remain in their own language so users can recover from a mistaken choice; translate the field label and automatic-mode wording. Optionally show the currently resolved language beside Automatic. Avoid country flags because the setting selects a language, not a nationality.

Changing the selection immediately updates the open menu and table behind it. Keep keyboard focus on the selector, preserve typed names and other drafts, and do not close/reopen the dialog. Persist on selection, including before a match starts. Existing routes back to the starting/settings menu expose the same selector; do not add an in-game settings overlay as an unrelated feature.

Use a labeled control, proper selected state, and an accessible name in the active language. Do not announce every translated element. Changing the document language plus a short confirmation, if needed, is sufficient. The selector uses the existing neutral glass controls rather than another colored panel.

## Translation architecture

Create a small, typed localization layer under `webclient/src/i18n/`:

```text
i18n/
  types.ts                Locale, preference, message and argument types
  resolveLocale.ts        Guarded storage and browser preference resolution
  I18nProvider.tsx        Locale state, preference setter, document metadata
  format.ts               Numbers, plurals, lists, and domain display helpers
  messages/
    en.ts                 English catalog
    de.ts                 German catalog
    hr.ts                 Croatian catalog
  eventMessages.ts        Structured game-event rendering
  errorMessages.ts        Stable error-code rendering
  meldMessages.ts         Meld descriptor rendering
```

Mount the provider above `App` in `main.tsx`, leaving the provider's identity stable. Portal dialogs inherit React context, so they use the same translations without special DOM attributes. Keep all three small catalogs bundled initially for offline browser play and immediate switching; no translation network service or asynchronous locale download is needed.

Define stable semantic keys such as `setup.startMatch`, `controls.forfeitGame`, `melds.empty`, and `status.chooseCard`. Use a shared message schema that enforces the same keys and interpolation argument types across catalogs. A missing key falls back to English without showing raw key names or crashing the game; mark this as a migration safeguard, not acceptable completion.

Use complete sentence templates with named arguments. Translators control word order, punctuation, and plural forms. Avoid joining fragments such as a translated player name plus an English verb plus a numeric suffix. Render values as React text, never interpolated HTML.

Use built-in locale formatting for numbers and lists, and `Intl.PluralRules` for language-appropriate count variants. Explicitly supply catalog variants for each supported language rather than assuming singular/plural is sufficient. Keep formatting helpers separate from numeric game data: a formatted score must never be parsed back into scoring logic.

Use a language-matched formatting policy (`en`, `de`, `hr`) for this first release. Changing language changes display conventions as well. Preserve raw timestamps and event sequence numbers. Do not introduce unrelated dates, times, or new information into the UI just to localize them.

## Domain terminology and card presentation

Before filling catalogs, establish an English/German/Croatian glossary covering match, game, trick, trump, dealer, declarer, meld, sequence, four of a kind, Bela, pass, forfeit, rematch, points, and wins. Distinguish a trick from a complete game and a game from a match everywhere, including history headings.

Croatian and German card-game terminology needs fluent review for this specific Belot ruleset. Do not present improvised literal translations as authoritative. Record chosen terms and short UI variants in the glossary; correctness takes priority over fitting an arbitrary button width.

Keep suits, ranks, action enums, and CSS classes unchanged internally. Preserve the existing printed card symbols and rank letters in this pass; changing deck art or regional rank lettering is a separate decision. Localize screen-reader descriptions into full rank/suit names, including the owner when relevant, rather than reading internal shorthand such as `as` or `10c`.

Do not translate Belot/Bela identifiers, player IDs, arbitrary team/player names, or user text. Do not apply CSS uppercase/lowercase as a substitute for language-aware wording. Preserve Unicode accents and Croatian characters in catalogs and user names.

## Player names and default labels

Separate role labels such as Your team, Opponents, You, and Partner from actual saved names. Translate role labels freely. Preserve every existing submitted name exactly, even if it happens to equal an English default.

For a fresh lobby, localized default suggestions may be supplied before its initial creation/update, with explicit metadata recording which drafts are untouched suggestions. A selector change may update only untouched suggestions. Editing a field marks it user-owned; choosing another language must never overwrite it. Restored sessions are user-owned unless reliable default metadata proves otherwise.

Do not infer default status by comparing a name to `You`, `Us`, or another catalog string. Avoid locale changes triggering the current automatic name-sync effect accidentally. Define this ownership model before implementing translated defaults; translating role labels alone is the safe intermediate state.

## Engine messages, errors, and backward compatibility

The frontend should own translations. The engines should emit facts and stable codes, not German/Croatian text. Do not add the selected UI language to game commands or use it in engine calculations.

Create an inventory of every emitted event and required payload field in both facades. Existing `type` and `payload.eventKind` can be reused when sufficiently specific; introduce a message code only when the current event identity is ambiguous. Add missing structured data such as actor/player ID, team identity, suit/rank, point count, or reason. Do not infer missing fields by parsing an English `message`.

During migration, keep legacy `message`, `prompt`, `label`, and error text fields intact for older clients. Add optional descriptors first, then have the new UI prefer them. Update Java records, session/controller serialization, TypeScript interfaces, browser facade, and gateways together. Do not silently change `Record<string, string>` payloads into arbitrary nested objects without an explicit contract change.

For melds, carry a stable kind plus relevant facts such as sequence length and rank through to declaration history. `MeldDeclarationView.labels` alone cannot reliably describe a meld in another language later. Existing combination data may supply some facts; document any additions needed in both runtime views.

For errors, add a stable code with named arguments to the API response and browser-side error object. Preserve HTTP status for existing recovery. Keep a localized error descriptor in App state, not the translated sentence, so an open error updates with locale. Unexpected technical exceptions use a localized safe message in the UI while diagnostic detail remains available to developers. Do not expose raw stack traces or translate developer diagnostics.

Unknown new message codes should produce a localized generic event/error with its stable reference where useful. Existing records with only legacy text may display that text as a temporary compatibility fallback; explicitly acknowledge possible mixed-language history. Newly produced supported events must all be fully localizable before completion. Do not label this fallback a full translation solution.

## History, summaries, and active-state preservation

Keep events as raw structured data and translate at render time. Switching locale should update already-visible history, results, melds, and pending actions without changing sequence IDs or event keys. Never key a card, dialog, provider, or event row by translated text.

Review memoized derived data and summary objects. They must retain IDs/counts/descriptors rather than frozen localized strings, and rendering memoization must include locale where it formats text. Keep animation timelines based on existing IDs, phases, and card data.

Preserve terminal reading position when text wraps differently. Capture the visible event key and offset before changing locale, then restore that anchor after rendering. Existing scroll anchoring can be extended for this purpose; do not jump to the newest event. Dialog content should preserve focus and scroll position during a locale-only change.

## Responsive and accessible text

The current design has compact fixed-width controls, especially match actions, and truncated status/name fields. German and Croatian translations may need more room.

- Use content-aware button sizing and concise, semantically complete translations. Permit wrapping or a responsive layout change before shrinking text.
- Preserve the near-equal hand/played-card hierarchy and existing viewport-height sizing. Allow exceptional scrolling rather than hiding controls.
- Keep confirmation consequences and required actions fully readable. Do not rely on a tooltip to reveal essential truncated instructions.
- Ensure score values and targets remain distinguishable with locale separators and long team names.
- Translate accessible names, region labels, SVG titles, input placeholders, tooltips, loading/empty states, validation, and hidden card descriptions alongside visible copy.
- Update `document.documentElement.lang` and the document title whenever locale changes. All three languages use left-to-right layout; no RTL redesign is required.
- Avoid using localized text as an ARIA ID, selector, React key, or data discriminator.

## Implementation sequence

| Phase | Deliverable | Completion gate |
| --- | --- | --- |
| 1. Inventory and glossary | Source-to-key inventory, domain glossary, event/error/meld descriptor map | Every player-facing text source has an owner; uncertain terms are recorded |
| 2. Locale foundation | Resolver, catalogs/schema, provider, document metadata, guarded preference persistence | Deterministic detection and explicit preference contract implemented |
| 3. Starting menu | Language selector, immediate rerender, safe default-name handling | No new session or gameplay request on a locale-only change |
| 4. Static UI migration | Setup, table, controls, all dialogs, accessibility strings | No hardcoded supported UI prose remains in active components |
| 5. Runtime descriptors | Additive Java/browser event, meld, prompt, and error facts | Equivalent semantics across both runtimes; legacy consumers retained |
| 6. Dynamic presentation | Localized terminal, summaries, meld history, errors, card descriptions | Language changes re-render existing data without replaying gameplay |
| 7. Translation and layout polish | Full German/Croatian catalogs, reviewed glossary, flexible control sizing | No placeholders, broken interpolation, or unresolved text sources |
| 8. Documentation and handoff | User language instructions, architecture/API updates, validation record | Implemented scope and any unverified behavior stated accurately |

Stages are reviewable increments. English should remain usable at each stage. Avoid a single global string-replacement pass, simultaneous engine-rule refactors, or an unrelated dependency upgrade. No new internationalization dependency is required by this proposal; reconsider only if the catalog's grammar requirements justify it.

## Validation plan ? deferred under the no-testing instruction

The following describes future verification if testing is authorized. It is not permission to run tests, builds, or browser checks now.

1. Locale resolution cases: saved override, automatic mode, regional tags, unsupported first choice followed by supported second choice, empty/malformed values, denied storage, refresh, and browser-language changes.
2. Catalog coverage: matching keys/argument types, missing-key fallback, safe interpolation, representative count forms including zero and multi-digit values, Unicode, and number formatting.
3. Both game runtimes: setup, trump, meld declaration/review, Bela, trick completion, game/match result, forfeit, quit, validation errors, missing sessions, and unknown event codes.
4. State preservation: switch language in a populated menu and verify typed names/settings, existing session, card identities, animation phase, focus, and history anchor remain intact. Verify legacy text fallback is bounded and documented.
5. UI matrix: all three locales on narrow phones, portrait tablets, short landscape, desktops, and wide displays, including text zoom and long custom names. Inspect long confirmation wording, score targets, controls, and popup scroll behavior.
6. Accessibility: document language, keyboard selector use, screen-reader card descriptions, localized live announcements, focus restoration, and reduced-motion behavior.
7. Fluent language review: German and Croatian game terminology, idiomatic wording, grammatical counts, and destructive-action clarity. Automated checks cannot establish translation quality.

## Definition of done and material risks

Done means all three locales work across both runtimes, browser settings select the initial supported language, the starting menu can override/reset it, preferences persist when storage is available, and language changes are display-only. New game history and meld records must be fully translatable without parsing prose. Player-entered names remain untouched.

The largest risks are engine-generated text escaping the catalog, accidental session/name updates through App effects, missing history payload facts, duplicated or grammatically broken counts, and longer text damaging compact layouts. Address these through the staged contracts above rather than treating localization as a cosmetic search-and-replace task.

While testing remains prohibited, report implementation as unverified. Do not claim browser coverage, accessibility conformance, runtime parity, or fluent translation approval without the corresponding evidence.
