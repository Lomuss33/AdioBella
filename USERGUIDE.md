# User guide

[README](README.md) · [Maintainer guide](MAINTAINER.md) · [Documentation index](docs/README.md)

## Open the game

[Play Belot online](https://lomuss33.github.io/AdioBella/) in your browser. No local installation is needed for the hosted version. To run your own copy, follow the [local setup](docs/development.md).

You sit at the bottom of the table (South). Your AI teammate sits opposite you (North); West and East are the opposing team.

## Set up a match

Before the first deal, set your team and player names and choose:

| Setting | Choices |
| --- | --- |
| AI difficulty | Easy, Normal, Hard |
| Game length | Short: 501 points; Long: 1001 points |
| Match length | First to 1, 3, or 5 game wins |
| Table theme | Choose the appearance of the table |

Start the match when ready.

## Play

1. **Choose trump.** When prompted, select a suit or skip if the game offers that option.
2. **Declare melds.** Use the meld prompt to declare or decline. Review the winning melds and acknowledge them before play continues.
3. **Play a card.** Select an available card from your hand when it is your turn. The game controls which cards you may play.
4. **Call Bela.** When an eligible card opens a Bela prompt, choose whether to call Bela or play without calling.
5. **Follow the result.** Use the scores and event log to follow tricks and game progress. Continue from the game-complete prompt; after the match ends, you can start a rematch.

The three AI players take their turns automatically. Cards may be temporarily unavailable while an action or trick animation finishes.

**Forfeit game** concedes the current game. **Quit match** concedes the match. Use these controls when you intend to give up the corresponding result.

## Sessions and settings

The online version keeps the game in the current page's memory. Reloading or closing it loses the match.

The local server version stores a session identifier in your browser and can restore the session while that server still holds it in memory. Restarting the server loses its games. The table theme is stored separately in the browser.

## Troubleshooting

- **Cannot play a card:** finish any open prompt and wait for your turn or the current animation.
- **Online page is blank:** check that you opened the link above, then reload. Reloading discards an online match.
- **Local game stops responding:** confirm that the local server is running, then reload. If it still fails, remove the `belot-session-id` entry from that site's local storage and reload to start a fresh session.
- **Local startup or port error:** see [development troubleshooting](docs/development.md#troubleshooting).

When reporting a problem, include whether you played online or locally, your browser, the steps that led to it, and the visible error or a screenshot.
