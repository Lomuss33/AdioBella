# Private multiplayer rooms

[Documentation index](README.md) · [Development](development.md) · [Deployment](deployment.md)

## Play on your server

Run `npm run dev:full` for development (`http://localhost:1111`, API at `http://localhost:1112`), or `./gradlew runGame` (`.\gradlew.bat runGame` on Windows) for the packaged app. Choose **Play with friends** in the solo setup. The same button is below the table during an active solo game; switching to rooms does not concede that game.

1. Enter your name and create a room. The host sits South.
2. Copy the invitation to friends who can reach this server. Each friend enters their name and chooses North (the host's partner), West, or East (opponents).
3. The host chooses 501/1001 points and 1/3/5 wins, saves settings, then starts. Any unoccupied places become bots. Seats lock when play starts.
4. Each player sees their own hand and can act only when required. Meld declarations are requested from each human with melds; the host acknowledges the result before card play resumes.
5. Open **All my rooms** to switch between games. Reopen a room in the same browser to retain your seat. Closing the tab does not remove a player or automatically concede. This version has no turn timeout or automatic takeover of an absent human.

For separate people on one computer, use separate browser profiles or private windows. Tabs in the same browser share the same saved membership. The invite grants permission to claim a vacant seat before the start, not access to an existing player's hand. Keep invite links private. A player's secret token stays in browser storage and is sent in an `Authorization` header, never in an invitation URL. Clearing browser storage loses that player's access; account-based recovery is not implemented.

The default server runtime's solo sessions still depend on server memory. Browser-only solo saves are independent of rooms. The Pages build supports solo without a backend; rooms need the homelab backend to be reachable.

## Storage and capacity

Rooms use local files, with no database account, paid API, or cloud billing. By default the server writes `data/rooms/<room-uuid>.json` relative to its working directory (`server/data/rooms` when launched with Gradle). These default directories are ignored by Git. Set `BELOT_ROOMS_DIRECTORY` to an absolute path for predictable homelab storage. This directory must be on a writable filesystem supporting atomic replacement. Back it up and keep it outside the web root; it contains private game information. If running in a container, mount it on a persistent volume. Use one server process per room directory; concurrent processes sharing the directory are not supported.

Every successful action is written before the response confirms it. Saves contain a random seed, members with hashed access tokens, and the accepted command history. A restarted server reconstructs the game from that history. An invalid action or failed disk write leaves the previous committed game intact. Repeated commands with the same request UUID return the current state without taking another turn; stale revisions return HTTP 409.

Default capacity is 100 stored rooms, configurable through `BELOT_ROOMS_MAX_ROOMS`. A room accepts up to 10,000 actions. At capacity, new rooms/actions are refused rather than purchasing resources. Finished rooms still count; an operator can stop the server and archive/remove the corresponding JSON files. There is no automatic deletion or player-facing room deletion yet. The service uses server memory for loaded games, and disk, electricity, and internet from the homelab.

The versioned command journal is intended for this application version. Keep backups before engine upgrades: replay behavior can change when rules or AI change. Event order and game state survive a restart, but event timestamps are regenerated during replay. No paid standby server is created. If the homelab is down, multiplayer waits until it returns.

## Free static frontend plus homelab backend

The simplest setup serves both frontend and API from Spring Boot at the same origin. For a separate static frontend, set `VITE_MULTIPLAYER_URL` to the backend's public HTTPS origin **when building the frontend**:

```powershell
$env:VITE_MULTIPLAYER_URL = "https://your-game-server.example"
npm --prefix webclient run build:pages
```

Use your actual server address. On the server set `BELOT_ROOMS_ALLOWED_ORIGINS` to the exact frontend origin, for example `https://lomuss33.github.io` (no repository path). Multiple origins are comma-separated. CORS applies only to `/api/rooms/**`, with no cookie authentication. The existing solo session API is not exposed cross-origin by this setting. Use HTTPS for public access so seat tokens are encrypted in transit. Public routing, TLS, domains, and homelab deployment are not configured by this change.

Without a configured backend, the production browser-only build disables room creation and joining and keeps solo available. Development mode can use Vite's existing `/api` proxy. An open room refreshes every two seconds only while its tab is visible; hidden tabs stop making room reads. There is no constant server simulation while a human is thinking.

## HTTP contract

The room API is separate from the legacy solo API. All room responses use `Cache-Control: no-store`.

| Method | Path | Body / authorization |
| --- | --- | --- |
| POST | `/api/rooms` | `{ "name": "Host" }`; returns `{ token, room }` |
| POST | `/api/rooms/{id}/join` | `{ "name": "Friend", "seat": "north" }`; returns `{ token, room }` |
| GET | `/api/rooms/{id}` | `Authorization: Bearer <member token>` |
| POST | `/api/rooms/{id}/actions` | Same authorization; command body below |

All commands require a unique UUID `requestId`, the last observed numeric `revision`, and `action`. Actions are `START`, `TRUMP` (`choice`), `MELDS` (`declare`), `ACK`, `CARD` (`handIndex`, `callBela`), `SETTINGS` (`gameLength`, `matchTargetWins`, optional `difficulty`), and `FORFEIT`. Start, settings, and meld acknowledgement belong to the host; trump, declarations, and card play belong to the pending actor. Forfeit concedes the acting member's own team, even when they are not on turn.

A room response includes `roomId`, `revision`, `yourSeat`, `host`, `seats`, a player-specific `snapshot`, and up to 40 recent public `events`. Opponent cards are placeholders. Other players' legal actions and undeclared meld offers are omitted. HTTP status codes distinguish invalid input (400), missing/bad member credentials (401), wrong actor/host (403), missing rooms (404), conflicting seat/revision/request ID (409), and unavailable storage/capacity (503).

Profiles, friend lists, cross-device recovery, notifications, ranked play, and timed modes are follow-up work.
