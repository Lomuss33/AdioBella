# Maintainer Guide

## Purpose

This document explains how the current Belot application is structured and where to change things safely.

## Architecture

### Engine

- path: `engine/src/main/java/com/belot/engine/api`
- entrypoint: `BelotMatchFacade`
- responsibility:
  - own match state
  - validate player actions
  - produce snapshots and event records
- rule:
  - keep engine free of UI and Spring dependencies

### Server

- path: `server/src/main/java/com/belot/server`
- responsibilities:
  - create and store in-memory sessions
  - expose REST commands
  - expose SSE event stream
  - serve built frontend assets

Important files:

- `server/.../session/GameSession.java`
- `server/.../session/GameSessionRegistry.java`
- `server/.../web/SessionController.java`

### Frontend

- path: `webclient/src`
- responsibilities:
  - render the table
  - render terminal log
  - call REST commands
  - subscribe to SSE updates

Important files:

- `src/App.tsx`
- `src/components/*`
- `src/lib/sessionApi.ts`
- `src/lib/eventStream.ts`
- `src/lib/cardPresentation.ts`
- `src/styles/playing-cards.css`

## Runtime Flow

1. Browser creates or restores a session.
2. Browser sends commands by REST.
3. Server forwards commands into `BelotMatchFacade`.
4. Engine returns updated snapshot state and appends events.
5. Browser listens to SSE for terminal updates.
6. Browser refreshes the snapshot on a short debounce after events.

## Ports And Startup

Default:

```bash
./gradlew runGame
```

Custom port:

```bash
./gradlew runGame -PserverPort=28081
```

To find a conflicting process on Windows:

```powershell
netstat -ano | findstr :8080
Get-Process -Id <PID>
Stop-Process -Id <PID> -Force
```

## Card CSS Integration

The current card styling is a local adaptation of the class model used by `selfthinker/CSS-Playing-Cards`.

Expected card classes:

- container: `playingCards`
- card shell: `card`
- suit classes:
  - `clubs`
  - `diams`
  - `hearts`
  - `spades`
- rank classes:
  - `rank-7`
  - `rank-8`
  - `rank-9`
  - `rank-10`
  - `rank-j`
  - `rank-q`
  - `rank-k`
  - `rank-a`
- hidden card:
  - `card back`

If you change card rendering, keep these class names stable unless you intentionally rewrite the card presentation layer.

## Placeholder Asset Naming

Card assets:

- `webclient/src/assets/cards/face-placeholder.svg`
- `webclient/src/assets/cards/back.svg`

Suit assets:

- `webclient/src/assets/suits/clubs.svg`
- `webclient/src/assets/suits/diamonds.svg`
- `webclient/src/assets/suits/hearts.svg`
- `webclient/src/assets/suits/spades.svg`

Visible card labels under cards must stay lowercase:

- `10c`
- `ad`
- `7s`

Suit labels under trump controls must stay lowercase full names:

- `clubs`
- `diamonds`
- `hearts`
- `spades`

## Safe Extension Rules

- Do not put UI logic into the Java engine.
- Do not serialize engine internals directly from Spring controllers.
- Prefer extending DTOs over exposing internal engine structures.
- Keep card/suit asset mapping in `cardPresentation.ts`, not scattered through components.
- Keep API calls in `sessionApi.ts`.
- Keep SSE behavior in `eventStream.ts`.

## Testing Checklist

Before merge:

```bash
./gradlew build
./gradlew :engine:test
./gradlew :server:test
cd webclient
npm test
```

Manual checks:

- start the app on default or custom port
- start a match
- choose trump
- play several cards
- verify table cards, hidden opponent cards, and terminal behavior

## Known Limitations

- single-player only
- in-memory session registry only
- placeholder art only
- no persistence
