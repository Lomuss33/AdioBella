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
| Lifetime | Server memory; browser stores the session ID | Page memory; session ID is not persisted |

These are separate implementations, not generated copies. Changes to rules, AI decisions, scoring, or session behavior need equivalent changes and verification in both.

## State and events

1. [App.tsx](../webclient/src/App.tsx) creates or restores a session through the selected gateway.
2. A user action reaches the session and rules facade.
3. The facade validates the action, advances state and AI turns, and produces snapshots and events.
4. The command returns a session response with a snapshot.
5. The event subscription supplies log updates; the app debounces snapshot refreshes and coordinates trick animations.

The Java engine exposes view records in [engine/api](../engine/src/main/java/com/belot/engine/api). Frontend equivalents live in [types.ts](../webclient/src/types.ts). Keep these aligned, especially legal card indices, pending actions, scores, and meld/Bela information.

The server stores sessions in [GameSessionRegistry](../server/src/main/java/com/belot/server/session/GameSessionRegistry.java). There is no database or durable game save. Storing a session ID in local storage does not persist server state.

## Where to change things

| Concern | Source |
| --- | --- |
| HTTP endpoints and request records | [SessionController.java](../server/src/main/java/com/belot/server/web/SessionController.java) |
| API error mapping | [ApiExceptionHandler.java](../server/src/main/java/com/belot/server/web/ApiExceptionHandler.java) |
| Lobby, action overlays, meld/Bela prompts | [ActionPanel.tsx](../webclient/src/components/ActionPanel.tsx) |
| Table and seats | [TableLayout.tsx](../webclient/src/components/TableLayout.tsx) and [components](../webclient/src/components) |
| Animation timing and sequencing | [trickAnimation.ts](../webclient/src/lib/trickAnimation.ts) |
| Card labels and asset mapping | [cardPresentation.ts](../webclient/src/lib/cardPresentation.ts) |
| Card appearance | [PlayingCard.tsx](../webclient/src/components/PlayingCard.tsx), [playing-cards.css](../webclient/src/styles/playing-cards.css) |
| App layout and themes | [app.css](../webclient/src/app.css) |
| Active table and terminal layout | [table.css](../webclient/src/styles/table.css); one responsive seat layout, theme-colored felt, and team-colored scores |
| Responsive popups and confirmations | [popups.css](../webclient/src/styles/popups.css), [usePopupDialog.ts](../webclient/src/lib/usePopupDialog.ts), [ConfirmPopup.tsx](../webclient/src/components/ConfirmPopup.tsx) |
| Runtime selection and Pages path | [.env.pages](../webclient/.env.pages), [vite.config.ts](../webclient/vite.config.ts) |
| Frontend packaging into Spring Boot | [server/build.gradle.kts](../server/build.gradle.kts) |

The older [sessionApi.ts](../webclient/src/lib/sessionApi.ts) and [eventStream.ts](../webclient/src/lib/eventStream.ts) remain in the tree but are not used by the active app. Extend the gateway path for current functionality.

## Presentation conventions

Card CSS uses `playingCards`, `card`, and `card back`; suits use `clubs`, `diams`, `hearts`, and `spades`. Rank classes run from `rank-7` through `rank-a` for the Belot deck. Keep these conventions stable unless updating the presentation layer together.

Visible card labels stay lowercase, such as `10c`, `ad`, and `7s`. Trump controls use lowercase full suit names. Asset placeholders live in [cards](../webclient/src/assets/cards) and [suits](../webclient/src/assets/suits); the root favicon is synced into `webclient/public/` by the Gradle frontend build.

## Boundaries

Keep rules and action validation in the engines, session lifecycle in session classes, transport in gateways/controllers, and rendering in React. Expose view models rather than serializing private engine state. Browser-only builds must remain playable without API calls.

## Localization

The client locale store in `webclient/src/i18n/index.ts` resolves and persists `auto`, `en`, `de`, or `hr` independently of sessions and gameplay settings. App subscribes without remounting the game tree. The starting dialog uses `LanguageSelect`; all three catalogs ship together for offline browser play. `presentation.ts` translates stable event/error/meld data at render time, so history can follow a locale change. Keep enum values, card identity, names, and numeric game state untranslated. See [localization design and implementation](localization-plan.md) for compatibility and validation details.
