# Session API

[Documentation index](README.md) · [Architecture](architecture.md)

This HTTP API belongs to the local Spring Boot runtime. The Pages runtime exposes equivalent operations through an in-process gateway.

The authoritative request and response definitions are in [SessionController.java](../server/src/main/java/com/belot/server/web/SessionController.java). The active frontend consumer is [serverGateway.ts](../webclient/src/lib/serverGateway.ts).

## Endpoints

Paths below are relative to `/api/sessions`. Use JSON bodies with `Content-Type: application/json`. `{id}` is the UUID returned when creating a session.

| Method | Path | Body or query |
| --- | --- | --- |
| POST | (base path) | Optional `{"difficulty":"NORMAL"}` |
| GET | `/{id}` | None |
| POST | `/{id}/start` | None; starts the match or next game as permitted by state |
| POST | `/{id}/players` | `{"playerNamesBySeat":{"SOUTH":"You","NORTH":"Partner","WEST":"West","EAST":"East"}}` |
| POST | `/{id}/settings` | Lobby settings described below |
| POST | `/{id}/trump` | `{"choice":"CLUBS"}`; use a choice allowed by the pending action |
| POST | `/{id}/melds` | `{"declare":true}` |
| POST | `/{id}/melds/ack` | `{"acknowledged":true}` |
| POST | `/{id}/card` | `{"handIndex":0,"callBela":false}` |
| POST | `/{id}/forfeit` | None; concedes the game |
| POST | `/{id}/quit` | None; concedes the match |
| GET | `/{id}/events` | Optional `afterSequence`, default `0` |
| GET | `/{id}/stream` | SSE; optional `afterSequence`, default `0` |

Lobby settings fields are `difficulty` (`EASY`, `NORMAL`, `HARD`), `playerNamesBySeat`, `yourTeamName`, `enemyTeamName`, `matchTargetWins` (1, 3, 5), and `gameLength` (`SHORT`, `LONG`). Settings and actions are validated against current game state.

## Responses and events

Session creation, snapshot reads, and command endpoints return `{ sessionId, snapshot }`. See [GameSnapshot.java](../engine/src/main/java/com/belot/engine/api/GameSnapshot.java) and [types.ts](../webclient/src/types.ts) for the snapshot shape.

The events endpoint returns an array of events after the supplied sequence. The stream uses `text/event-stream` and sends JSON events; consumers track sequence numbers and close subscriptions when leaving a session.

`handIndex` is a zero-based index into the current hand. Use indices and choices from the current pending action rather than guessing valid moves.

[ApiExceptionHandler](../server/src/main/java/com/belot/server/web/ApiExceptionHandler.java) maps `IllegalArgumentException` to HTTP 400 with `{"error":"..."}`. This includes application validation failures; do not assume every missing session produces a 404. Other framework errors may have a different response shape.
