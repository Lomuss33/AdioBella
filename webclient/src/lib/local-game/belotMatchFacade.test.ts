import { describe, expect, test } from "vitest";
import { BelotMatchFacade } from "./belotMatchFacade";
import { SeededRandom } from "./random";

describe("BelotMatchFacade", () => {
  test("new match starts in ready state", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    const snapshot = facade.getSnapshot();

    expect(snapshot.phase).toBe("READY_TO_START");
    expect(snapshot.pendingAction.type).toBe("START_MATCH");
    expect(snapshot.players).toHaveLength(4);
    expect(snapshot.score.teamOneName).toBe("Us");
    expect(snapshot.score.teamTwoName).toBe("Them");
    expect(snapshot.players[0].name).toBe("You");
    expect(snapshot.players[1].name).toBe("Zapad");
    expect(snapshot.players[2].name).toBe("Ti");
    expect(snapshot.players[3].name).toBe("Istok");
  });

  test("start match deals cards and requests trump", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    facade.startMatch();

    const snapshot = facade.getSnapshot();
    expect(snapshot.phase).toBe("TRUMP_SELECTION");
    expect(snapshot.pendingAction.type).toBe("CHOOSE_TRUMP");
    expect(snapshot.players.reduce((total, player) => total + player.handSize, 0)).toBe(24);
    expect(snapshot.players[0].handSize).toBe(6);
  });

  test("human play consumes the selected card", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    facade.startMatch();
    facade.chooseTrump("HEARTS");

    const beforePlay = facade.getSnapshot();
    const playableIndex = beforePlay.pendingAction.legalCardIndices[0];
    facade.playCard(playableIndex);

    const afterPlay = facade.getSnapshot();
    expect(beforePlay.players[0].handSize).toBe(8);
    expect(afterPlay.players[0].handSize).toBe(7);
    expect(afterPlay.trick.cards.length).toBeGreaterThan(0);
  });

  test("invalid card play is rejected", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    facade.startMatch();
    facade.chooseTrump("SPADES");

    expect(() => facade.playCard(99)).toThrow("That card is not legal in the current trick.");
    expect(facade.getSnapshot().pendingAction.validationMessage).toBeTruthy();
  });

  test("engine can advance through multiple turns", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    facade.startMatch();
    facade.chooseTrump("CLUBS");

    for (let step = 0; step < 12 && !facade.getSnapshot().matchComplete; step += 1) {
      const snapshot = facade.getSnapshot();
      if (snapshot.pendingAction.type === "PLAY_CARD") {
        facade.playCard(snapshot.pendingAction.legalCardIndices[0]);
      }
    }

    expect(facade.getEventsAfter(0).length).toBeGreaterThan(5);
  });

  test("play card event contains animation payload", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    facade.startMatch();
    facade.chooseTrump("HEARTS");

    const snapshot = facade.getSnapshot();
    facade.playCard(snapshot.pendingAction.legalCardIndices[0]);

    const playEvent = facade.getEventsAfter(0).find((event) => event.payload.eventKind === "PLAY_CARD");
    expect(playEvent?.payload.playerId).toBe("south");
    expect(playEvent?.payload.playerSeat).toBe("SOUTH");
    expect(playEvent?.payload.rank).toBeTruthy();
    expect(playEvent?.payload.suit).toBeTruthy();
  });

  test("trick win event contains winner seat points and last trick bonus field", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    facade.startMatch();
    facade.chooseTrump("SPADES");

    for (let step = 0; step < 32 && facade.getSnapshot().pendingAction.type === "PLAY_CARD"; step += 1) {
      facade.playCard(facade.getSnapshot().pendingAction.legalCardIndices[0]);
      if (facade.getEventsAfter(0).some((event) => event.payload.eventKind === "TRICK_WIN")) {
        break;
      }
    }

    const trickWinEvent = facade.getEventsAfter(0).find((event) => event.payload.eventKind === "TRICK_WIN");
    expect(trickWinEvent?.payload.winnerSeat).toBeTruthy();
    expect(trickWinEvent?.payload.trickPoints).toBeTruthy();
    expect(trickWinEvent?.payload.lastTrickBonus).toBeTruthy();
  });

  test("lobby settings can rename teams before start", () => {
    const facade = new BelotMatchFacade(new SeededRandom(7));
    facade.updateLobbySettings("HARD", { SOUTH: "Lovro" }, "Blue Team", "Red Team", 5, "SHORT");

    const snapshot = facade.getSnapshot();
    expect(snapshot.score.teamOneName).toBe("Blue Team");
    expect(snapshot.score.teamTwoName).toBe("Red Team");
    expect(snapshot.players[0].name).toBe("Lovro");
    expect(snapshot.score.difficulty).toBe("HARD");
    expect(snapshot.score.matchTargetWins).toBe(5);
    expect(snapshot.score.gameTargetPoints).toBe(501);
  });
});
