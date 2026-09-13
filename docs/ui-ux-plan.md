# UI and UX improvement plan

Current color direction: [Casino color and material plan](color-material-plan.md). The restrained felt-and-glass palette is implemented in source and supersedes the colorful styling described below. Shared tokens cover all five themes, table, terminal, cards, and popups. Existing compact layouts are preserved. No tests, builds, or browser checks were run.

[Documentation index](README.md) · [Architecture](architecture.md) · [Development](development.md)

Status: popup work has been followed by a requested **table and terminal** layout pass. Other items in the broader redesign below remain proposals.

Implemented popup work: viewport-level native dialogs, independently scrollable content with visible action footers, mobile keyboard viewport handling, dark felt and gold styling, touch-sized controls, keyboard focus containment, reduced motion, and matching forfeit/quit confirmations. The table layout and game rules are outside this change.

The follow-up layout pass reduces outer margins and internal padding, removes nested frames, places setup fields in compact rows, and uses available landscape width to minimize scrolling. Overflow remains available for content that cannot fit. No tests, builds, or browser checks were run for this pass, as requested.

The popup palette now uses a midnight-blue base with teal for your team, rose for opponents, sapphire for match length, amber for game length, and individual colors for difficulty and table themes. Primary actions use champagne gold; safe cancellation uses teal and concession uses rose. Trump choices and result highlights have distinct color treatments. Labels and selected-state styling remain alongside color. This color pass was also made without tests, builds, or browser checks, as requested.

The table/terminal pass replaces duplicate seat layouts with one responsive arena, places scores ahead of expandable meld details, bounds card sizing, removes overlapping absolute status/control placement, and carries team colors into seats and scores. History can collapse, moves beside the table on wide screens, and preserves the visible entry while new events arrive. Game and match winners now receive separate colors. No tests, builds, or browser checks were run for this pass, per the continuing instruction.

The viewport-fit follow-up gives the table a dynamic viewport height budget with safe-area spacing. The remaining play area sizes its trick cards through a size container; the hand also scales with the height budget. Short landscape views place a two-row hand beside the play area. Long names truncate with full labels retained, and meld details now open in a portal-based dialog rather than expanding the header. A minimum usable table size allows scrolling on exceptionally small views. This follow-up was not tested or built, as requested.

Prior-pass validation (before the compact layout changes): both frontend builds and the 26 existing frontend tests passed. Chromium checks covered 10 popup states across 10 viewport sizes (320px to 3440px wide, including a 256px-high viewport). Keyboard containment, confirmation cancellation, action callbacks, and reduced-motion styling were checked. Native mobile keyboards and Safari/Firefox still need device/browser verification.

## Outcome

Make Belot easy to start, easy to read, and comfortable to play on a phone or desktop. At any point, a player should understand whose turn it is, what they can do, the trump suit, and the score without opening the event log.

Retain the green table, warm card faces, and restrained gold accent as the default identity. Reduce competing panels, borders, small labels, and decorative effects. Preserve the existing gameplay rules and both runtime modes.

## Evidence and limits

This plan is based on the current React components, CSS, action handlers, and the saved start-screen screenshot. The screenshot predates the current setup component and is historical visual context, not proof of today's rendered layout. A live viewport and interaction audit is the first implementation step. User research and accessibility conformance testing have not yet been performed.

| Finding | Evidence | Priority |
| --- | --- | --- |
| Selected trump may crash status rendering | `ScoreBar.tsx` interpolates the object returned by `toTrumpMeta` directly as `{trump}` before rendering its fields | P0: reproduce and fix first |
| Layout changes are difficult to reason about | `app.css` has 4,207 lines with repeated width, height, and orientation overrides | P1: consolidate with visual regression checks |
| Small text is a readability risk | Root font size is 12.5px, with several labels below 0.7rem; effective sizes depend on later overrides | P1: measure rendered sizes and improve hierarchy |
| Setup presents many equally weighted decisions | `ActionPanel.tsx` combines names, match length, game length, themes, and difficulty | P1: prioritize starting, progressively reveal customization |
| Dialog semantics exceed implemented behavior | `ActionPanel.tsx` sets `aria-modal` but has no focus containment or restoration logic | P1: use proper modal behavior or a nonmodal action area |
| Selection semantics need improvement | Setup pills communicate selection through CSS classes without radio or pressed-state semantics | P1: use accessible single-choice groups |
| Noninteractive cards use button markup | `PlayingCard.tsx` always returns a button, including displayed cards without an action | P1: separate display cards from playable controls |
| History may interrupt reading | `TerminalLog.tsx` resets both scroll positions whenever groups change | P2: preserve reading position and indicate new events |
| Copy is inconsistent or unclear | Labels include “Revenge,” “Play + Bela,” “MP,” and “GP” | P2: consistent plain-language labels |
| Motion preference is not handled in app CSS | No `prefers-reduced-motion` rule found in `app.css`; animation timing is also managed in TypeScript | P1: cover both visual and state timing |

Forfeit and quit already have native confirmation dialogs in `App.tsx`. Preserve that protection while improving placement and presentation.

## Proposed screen structure

Use three primary screens: setup, table, and results. Settings, rules help, and history are secondary views. Required in-game decisions appear beside the hand in a consistent action area, so the player can still inspect cards and scores.

```text
SETUP                     TABLE                         RESULTS
Belot                     Score · Trump · Menu          Winner and final score
Start match               Opponents / teammate          Brief score breakdown
Difficulty / length       Current trick                 Next game or Play again
Customize names/theme     Current action                Match settings
How to play               Your hand                     History
                          History (collapsed)
```

Desktop keeps the familiar four-seat spatial arrangement. Portrait uses a compact opponent row, central trick, and bottom hand with a nearby action area. Keep each player's identity and played-card ownership explicit when their position changes.

## Phase 0 — Establish a reliable baseline

1. Run browser mode and local server mode. Capture setup, trump selection, meld declaration, meld review, card play, Bela, game result, match result, and errors.
2. Reproduce the `ScoreBar` object-rendering issue after choosing trump. Replace the object child with intentional text and add a regression check that renders a snapshot with selected trump.
3. Capture representative viewports: 360×800, 390×844, 844×390, 768×1024, 1366×768, and 1920×1080. Also inspect text zoom and unusually long names.
4. Record which issues are observed, their reproduction steps, and screenshots. Create repeatable state fixtures for rare prompts and results without changing production rules.

Exit: every major state has a reproducible baseline; critical rendering failures are resolved before visual redesign.

## Phase 1 — Define the visual and interaction foundation

- Establish semantic tokens for background, surface, text, muted text, accent, focus, success, and error across all five themes.
- Use a readable system sans-serif for controls and scores; reserve an optional serif for major headings. Target 16px body text and 14px supporting text rather than shrinking the entire UI to fit.
- Define a small spacing scale, two corner-radius sizes, restrained shadows, and clear primary/secondary/destructive button styles.
- Build reusable buttons, fields, single-choice groups, status messages, and accessible dialogs. Include hover, focus, selected, disabled, pending, and error states.
- Organize CSS into tokens, foundation, layout, components, and deliberate responsive rules. Remove superseded declarations as each component migrates; avoid appending another global override section.

Exit: a small component specimen or test fixture demonstrates every state and theme; focus, contrast, and labels are reviewed before screens consume the components.

## Phase 2 — Simplify starting a match

- Present setup as a dedicated screen instead of a large modal covering an inactive table.
- Keep one prominent “Start match” action. Existing defaults allow starting without editing fields.
- Show difficulty and a concise match summary first. Keep game and match length easy to find; put names and appearance behind “Customize table.”
- Keep names grouped by team and label the human player “You” and the opposite seat “Your teammate.” Compass names can remain secondary.
- Use labeled theme swatches with a clear selected indicator. Keep the selected theme preview immediate.
- Explain the distinction between game points and games needed to win the match. Include a brief “How to play” entry without blocking experienced players.
- Provide validation beside fields, a pending state while starting, and a recoverable failure message that preserves entered settings.

Exit: a player can start with defaults in one action, find advanced settings, and reach the primary action on a small screen and with keyboard navigation.

## Phase 3 — Rebuild the table around play

- Consolidate game score, match progress, and trump into a compact, consistently positioned scoreboard. Use explicit labels such as “Game points” and “Games won.”
- Make the trick and the human hand the largest visual elements. Reduce the visual weight of opponent metadata and repeated decorative panels.
- Put the current action immediately above the hand: “Your turn — choose a card,” “Choose trump,” or the current AI player's turn.
- Distinguish legal cards through more than color. Keep rank and suit readable, make selection/focus unmistakable, and explain restrictions at the action level without inventing rule reasons absent from the engine.
- Preserve stable card identity and ordering during play; verify shrinking hands do not cause accidental adjacent-card selection.
- Keep the hand and current action visible during ordinary play at the target viewports. Use deliberate internal scrolling for long history or settings, never clip required controls to force a viewport fit.
- Move forfeit and quit into a match menu, with separate consequence-specific confirmations and a safe cancel action.

Exit: players can identify their next action, trump, score, and all playable cards without consulting history. Long names, eight-card hands, and phone landscape do not overlap required controls.

## Phase 4 — Make prompts, results, and recovery consistent

| State | Intended behavior |
| --- | --- |
| Trump | Suit buttons show symbol and name; pass appears only when legal; hand remains visible |
| Meld declaration | Show eligible combinations and points with “Declare melds” and “Pass” |
| Meld review | Identify the winning team and awarded points; one clear continue action |
| Bela | Associate the prompt with the selected card; use “Play and call Bela” and “Play without Bela” |
| Trick resolution | Briefly show winner and points before collecting; never require reading the event log |
| Game result | Winner, score explanation, match progress, and “Next game” |
| Match result | Winner, final games won, “Play again,” and a secondary settings action |
| Loading or command pending | Describe the operation, prevent duplicate submission, preserve layout |
| Connection error | Keep last known table visible, explain the issue, offer appropriate retry |
| Lost session | Explain that the game is unavailable and offer a new match; do not imply saved progress exists |

Avoid automatically retrying uncertain state-changing commands: refetch current state first. Browser refresh loses the game; explain this through brief help/setup copy rather than recurring interruptions.

Replace “Game Terminal” with a secondary “Game history” view. Preserve its scroll position when the user reads older entries, show a new-events indicator, and keep detailed diagnostics out of the primary play flow.

Exit: every state has a clear action, pending behavior, error behavior, and keyboard focus destination. No UI changes require a new game rule.

## Phase 5 — Accessibility and motion

Accessibility work starts with the foundation and is verified here across the complete flow.

- Use a 44×44 CSS-pixel product target for touch controls where possible; verify densely packed cards independently.
- Target WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text, and applicable non-text contrast requirements. Measure all themes and interactive states.
- Use native radio semantics for mutually exclusive settings, full spoken card names such as “Ace of hearts,” visible focus, and meaningful headings.
- Make decorative and noninteractive card displays non-focusable. Ensure only the active responsive representation of each player is exposed to assistive technology.
- For genuine modal dialogs, implement initial focus, containment, inert background, and focus restoration. Escape cancels dismissible dialogs; required gameplay choices stay in the nonmodal action area rather than creating a keyboard dead end.
- Announce essential turn and result changes through a restrained live region; do not announce every history entry.
- Respect reduced-motion preferences in CSS and the TypeScript animation timeline. Skipping motion must still complete the state transition and unlock input.
- Test keyboard-only play, screen-reader announcements, text resizing, and both device orientations.

Use the [W3C WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/) and [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) as verification references. These are targets for implementation, not a claim of current conformance.

Exit: complete a match flow without a pointer; no focus escapes a modal or disappears after a state change; reduced motion never leaves play locked.

## Implementation boundaries and order

Deliver small reviewable changes in this order:

1. Rendering regression fix and repeatable UI state fixtures.
2. Design tokens and accessible UI primitives.
3. Setup screen and settings hierarchy.
4. Responsive table, scoreboard, and hand.
5. Action area, results, history, and recovery states.
6. Final accessibility, motion, browser, and runtime verification; refreshed screenshots and user guide.

Primary files: `App.tsx`, `app.css`, `ActionPanel.tsx`, `TableLayout.tsx`, `PlayerHand.tsx`, `PlayingCard.tsx`, `ScoreBar.tsx`, `MatchDataCard.tsx`, `GameDataCard.tsx`, `MatchCornerControls.tsx`, `TerminalLog.tsx`, and `trickAnimation.ts`, under `webclient/src/`.

Split `ActionPanel` by user-facing state and extract session orchestration from `App` only where needed to support this work. Continue to consume `GameGateway` and current snapshots. If presentation requires new structured data, specify and verify equivalent Java and browser changes separately.

## Completion criteria

- Every existing gameplay action remains available in both runtimes.
- Setup, play, results, and recovery pass the viewport/state matrix without clipped controls or unintended page-wide horizontal scrolling.
- Scores, trump, legal actions, and the current turn are understandable without the history panel.
- Focus, contrast, touch controls, reduced motion, and readable card names pass manual inspection.
- Relevant frontend behavior tests pass, as do the normal and Pages builds. Run Java tests when changing contracts or engine behavior.
- Add meaningful regression coverage for trump rendering, setting selection, focus, duplicate actions, error recovery, and reduced-motion completion. Use screenshots for visual layout checks rather than brittle CSS assertions.
- Observe a small round of usability sessions with both new and experienced Belot players: start a match, identify their teammate and trump, play a legal card, explain the score, and find rematch. Record hesitations, errors, and assistance needed; revise before considering the redesign complete.
- Update the user guide and capture current screenshots after implementation. Keep this plan clearly distinguished from documentation of shipped behavior.

## Position cues

Visible developer compass labels have been replaced by a shared `SeatMarker` SVG in player seats, the local hand, and played-card ownership indicators. The miniature table marks the logical seat using position and an inward chevron. Turn changes trigger two brief directional pulses; winning markers receive a single ring, and played-card markers fade into place. Persistent shapes and gold accents preserve state after motion ends. Player names and descriptive positions remain available through accessible SVG labels and titles. Reduced-motion styling disables these animations. No tests, builds, or browser checks were run for this change, as requested.

Mobile trick sizing follow-up: the center now inherits a responsive card cap (up to 58px wide on phones, 52px in short landscape, 88px on desktop). Available table width and height can shrink cards further. Card faces and animation offsets share the same size calculation, with space reserved for ownership markers. This replaces the center?s fixed 88px cap that overrode mobile sizing. No tests, builds, or browser checks were run.

Card hierarchy follow-up: a persistent, invisible trick-size guide reports the fitted table-card width through ResizeObserver. Hand columns cap at 82% of that width, including the four-column landscape layout; narrower hand space can reduce them further. Updates are scheduled per animation frame and the observer is cleaned up on unmount. Rank/suit corner indices now use 30% of card width, center suits use 60%, and proportional corner radii/insets preserve the paper-card appearance at small sizes. Meld cards share the same typography. No tests, builds, or browser checks were run.

Position decoration refinement: removed the ownership icons beneath played cards and retained player names in accessible card labels. Seat-panel markers now sit as large, faint, clipped backgrounds behind the text, with no dedicated grid row. The hand indicator remains inline. No tests, builds, or browser checks were run.

## Meld details and panel refinement

The meld history dialog now shows each player/team, declaration labels, separate meld and Bela totals, and a useful empty state. Its heading and close controls remain outside the scrollable, keyboard-focusable details region; player summaries use two columns where space permits and one on narrow phones. Seat-panel decorations now use broad translucent inward chevrons behind the copy, with short, reduced-motion-aware active-turn emphasis. Score panels align Wins, Points, and Melds into consistent columns, separate quieter target values, and use restrained team tints. The status strip uses aligned trump/status text and moves actions below the prompt on very narrow phones. No tests, builds, or browser checks were run under the user?s explicit instruction.

Card sizing correction: the hand now targets 95% of played-card width, superseding the earlier 82% ratio. Played cards also respect the available hand-row width, so narrow screens cannot leave oversized trick cards beside much smaller hand cards. Removed the hand?s separate viewport-height width cap, increased its available desktop/landscape width, and reduced the desktop trick cap to 80px. Resize synchronization covers hand appearance and breakpoint changes. No tests, builds, or browser checks were run.

Match-control refinement: removed the remaining inline hand marker. Consolidated match-action layout rules so the buttons stretch alongside the status panel, stack on phones, and form an equal-width row below the status on narrow or short landscape screens. Added restrained flag/exit icons, consistent dimensions, and explicit disabled/focus styling; existing confirmation handlers remain unchanged. No tests, builds, or browser checks were run.
