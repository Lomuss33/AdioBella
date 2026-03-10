# Projekt Belot

Belot is a single-player web implementation of the card game Belot. The game logic lives in a Java engine, the server is Spring Boot, and the browser UI is React.

## What The Project Is Now

- `engine`: pure Java match engine and view DTOs
- `server`: Spring Boot session API and SSE event stream
- `webclient`: React frontend with a table view and terminal log

The current version supports one human player against three AI players in the browser.

## Requirements

- Java 21+
- Node.js 20+ and npm
- Windows PowerShell or another shell that can run Gradle and npm

## Quick Start

Run the full application:

```bash
./gradlew runGame
```

Then open:

```text
http://localhost:8080
```

## Run On A Custom Port

If `8080` is already in use:

```bash
./gradlew runGame -PserverPort=28081
```

Then open:

```text
http://localhost:28081
```

## Development Commands

Build everything:

```bash
./gradlew build
```

Run engine tests:

```bash
./gradlew :engine:test
```

Run server tests:

```bash
./gradlew :server:test
```

Run frontend tests:

```bash
cd webclient
npm test
```

## Project Layout

```text
engine/
  src/main/java/com/belot/engine/api
server/
  src/main/java/com/belot/server
webclient/
  src/
```

## Card Placeholders

The UI uses local placeholder SVG assets for now.

- card face placeholder: `webclient/src/assets/cards/face-placeholder.svg`
- hidden card back: `webclient/src/assets/cards/back.svg`
- suit placeholders: `webclient/src/assets/suits/*.svg`

Visible cards always keep a short lowercase label under the card image:

- `10c`
- `ad`
- `7s`

Trump choice buttons use lowercase suit names under the suit image:

- `hearts`
- `clubs`
- `diamonds`
- `spades`

These assets are temporary and can be replaced later without changing the backend API.

## Troubleshooting

### Port Already In Use

Check which process owns a port:

```powershell
netstat -ano | findstr :8080
```

Inspect the PID:

```powershell
Get-Process -Id <PID>
```

Stop it if needed:

```powershell
Stop-Process -Id <PID> -Force
```

Or simply run on another port with `-PserverPort=...`.

### Stale Browser Session

The frontend keeps the active session id in browser storage. If a session becomes invalid, refresh the page or clear local storage for the site.

### Frontend Build Artifacts

The React app is built automatically by Gradle before the server starts. You do not need to copy files manually.

## Current Limitations

- single-player only
- in-memory sessions only
- placeholder card and suit art
- no persistence between server restarts
