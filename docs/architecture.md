# Architecture

[Documentation index](README.md) · [Development](development.md) · [Session API](api.md)

## Two runtimes, one UI

The React app uses [GameGateway](../webclient/src/lib/gameGateway.ts) for session commands and event subscriptions. `VITE_GAME_RUNTIME=browser` selects the browser implementation; other values select the server implementation.

| Layer | Server runtime | Browser runtime |
| --- | --- | --- |
| UI | Shared React components and `App.tsx` | Same |
| Transport | [serverGateway.ts](../webclient/src/lib/serverGateway.ts): HTTP and SSE | [browserGateway.ts](../webclient/src/lib/browserGateway.ts): in-process calls and subscriptions |
| Sessions | [GameSession.java](../server/src/main/java/com/belot/server/session/GameSession.java) and registry | [gameSession.ts](../webclient/src/lib/local-game/gameSession.ts) and gateway map |
| Rules | [BelotMatchFacade.java](../engine/src/main/java/com/belot/engine/api/BelotMatchFacade.java) | [belotMatchFacade.ts](../webclient/src/lib/local-game/belotMatchFacade.ts) |
| Lifetime | Server memory; browser stores the session ID | Current session and full engine state saved in browser local storage |

These are separate implementations, not generated copies. Changes to rules, AI decisions, scoring, or session behavior need equivalent changes and verification in both.

## State and events

1. [App.tsx](../webclient/src/App.tsx) creates or restores a session through the selected gateway.
2. A user action reaches the session and rules facade.
3. The facade validates the action, advances state and AI turns, and produces snapshots and events.
4. The command returns a session response with a snapshot.
5. The event subscription supplies log updates; the app debounces snapshot refreshes and coordinates trick animations.

The Java engine exposes view records in [engine/api](../engine/src/main/java/com/belot/engine/api). Frontend equivalents live in [types.ts](../webclient/src/types.ts). Keep these aligned, especially legal card indices, pending actions, scores, and meld/Bela information.

The server stores sessions in [GameSessionRegistry](../server/src/main/java/com/belot/server/session/GameSessionRegistry.java). There is no server database or durable server game save. Storing a session ID in local storage does not persist server state.

The browser gateway stores one current save in `belot-browser-save-v1` and the UI stores its identifier in `belot-browser-session-id`, separately from the Java server's `belot-session-id`. Successful session mutations save before broadcasting events. The versioned engine save includes private hands, pending actions, scores, and event history; public snapshots alone cannot restore a game. Restore validates the format and rebinds player/team/meld references that JSON duplicates. Event broadcasting resumes after the saved sequence. Unknown versions or damaged saves fall back to a fresh session. Browser randomness resumes with fresh random draws; future deals are not predetermined by the save. Storage failures leave the current tab playable but may prevent saving. Multiple tabs are not synchronized; the last writer wins. This local save is not suitable as trusted multiplayer state.

## Private rooms

Private rooms use a separate `/api/rooms` contract and [RoomService](../server/src/main/java/com/belot/server/room/RoomService.java), rather than placing multi-user games in the unauthenticated solo-session registry. The Java engine can configure human seats and generate player-specific snapshots. It queues each human's meld offer and redacts other players' pending choices. The TypeScript engine remains solo-only; its gameplay rules are unchanged.

[GameRoot](../webclient/src/GameRoot.tsx) routes `#rooms` and `#room=<uuid>` to [RoomHub](../webclient/src/components/RoomHub.tsx). The hub uses [roomGateway](../webclient/src/lib/roomGateway.ts) with per-member bearer tokens, visible-tab polling, revision checks, and idempotent command IDs. Membership tokens are saved separately from solo state. The server writes an atomic command journal before acknowledging each move, reconstructing the deterministic game after restart. See [Multiplayer](multiplayer.md) for storage, capacity, deployment, and the room API.

## Where to change solo behavior

| Concern | Source |
| --- | --- |
| HTTP endpoints and request records | [SessionController.java](../server/src/main/java/com/belot/server/web/SessionController.java) |
| API error mapping | [ApiExceptionHandler.java](../server/src/main/java/com/belot/server/web/ApiExceptionHandler.java) |
| Lobby, action overlays, meld/Bela prompts | [ActionPanel.tsx](../webclient/src/components/ActionPanel.tsx) |
| Table and seats | [TableLayout.tsx](../webclient/src/components/TableLayout.tsx), [components](../webclient/src/components), and [table-panels.css](../webclient/src/styles/table-panels.css) for scoreboard and seat surfaces |
| Animation timing and sequencing | [trickAnimation.ts](../webclient/src/lib/trickAnimation.ts) |
| Card labels and asset mapping | [cardPresentation.ts](../webclient/src/lib/cardPresentation.ts) |
| Card appearance | [PlayingCard.tsx](../webclient/src/components/PlayingCard.tsx), [playing-cards.css](../webclient/src/styles/playing-cards.css) |
| App layout and themes | [app.css](../webclient/src/app.css) |
| Active table and terminal layout | [table.css](../webclient/src/styles/table.css); one responsive seat layout, theme-colored felt, and team-colored scores |
| Responsive popups and confirmations | [popups.css](../webclient/src/styles/popups.css), [usePopupDialog.ts](../webclient/src/lib/usePopupDialog.ts), [ConfirmPopup.tsx](../webclient/src/components/ConfirmPopup.tsx) |
| Completed-match results | `MatchCompleteSummaryPanel` in [ActionPanel.tsx](../webclient/src/components/ActionPanel.tsx) and [match-result.css](../webclient/src/styles/match-result.css); paired team scores, localized final-game details, and persistent Settings/Rematch actions |
| Full-screen match setup and header layout | [setup-page.css](../webclient/src/styles/setup-page.css), loaded after the dialog styles; header controls occupy separate grid columns and the setup content scrolls above the start button |
| Runtime selection and Pages path | [.env.pages](../webclient/.env.pages), [vite.config.ts](../webclient/vite.config.ts) |
| Frontend packaging into Spring Boot | [server/build.gradle.kts](../server/build.gradle.kts) |

## Presentation conventions

Color palettes live in `webclient/src/lib/appearanceTheme.ts`. Table color owns the felt gradient and surrounding page background; interface accent owns actions, selected controls, decorative highlights, and keyboard focus. App applies their separate CSS variables before paint. Dialogs and control surfaces use fixed neutral materials from `tokens.css`, so changing the table cannot recolor the interface. Team identities and card suit colors remain independent of both settings. Picker swatches use the same palette definitions as the actual theme, with neutral selection badges. `appearanceTheme.test.ts` checks color contrast and variable ownership across all 36 combinations.

Card CSS uses `playingCards`, `card`, and `card back`; suits use `clubs`, `diams`, `hearts`, and `spades`. Rank classes run from `rank-7` through `rank-a` for the Belot deck. Keep these conventions stable unless updating the presentation layer together.

Visible card labels stay lowercase, such as `10c`, `ad`, and `7s`. Trump controls use lowercase full suit names. The original card symbols and back live in [src/assets](../webclient/src/assets); selectable deck artwork and its credits live in [public/assets/decks](../webclient/public/assets/decks). The root favicon is synced into `webclient/public/` by the Gradle frontend build.

## Boundaries

Keep rules and action validation in the engines, session lifecycle in session classes, transport in gateways/controllers, and rendering in React. Expose view models rather than serializing private engine state. Browser-only builds must remain playable without API calls.

## Localization

The client locale store in `webclient/src/i18n/index.ts` resolves and persists `auto`, `en`, `de`, or `hr` independently of sessions and gameplay settings. App subscribes without remounting the game tree. The starting dialog uses `LanguageSelect`; all three catalogs ship together for offline browser play. `presentation.ts` translates stable event/error/meld data at render time, so history can follow a locale change. Keep enum values, card identity, user-entered names, and numeric game state untranslated. Player and team defaults live in `webclient/src/i18n/defaultNames.ts` and follow the setup locale. Empty name fields show these defaults as placeholders; only user drafts are stored in preferences, so changing language never replaces a custom entry. The shared UI sends resolved names through either gateway before starting a match; names remain fixed during play. See [localization design and implementation](localization-plan.md) for compatibility and validation details.
