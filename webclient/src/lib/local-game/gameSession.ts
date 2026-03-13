import type { Difficulty, GameEvent, GameLength, GameSnapshot, MatchTargetWins, PlayerNameDrafts } from "../../types";
import { BelotMatchFacade } from "./belotMatchFacade";
import type { RandomSource } from "./random";
import { BrowserRandom } from "./random";

type Listener = (event: GameEvent) => void;

export class GameSession {
  private readonly facade: BelotMatchFacade;
  private readonly listeners = new Set<Listener>();
  private broadcastSequence = 0;

  constructor(
    private readonly sessionId: string,
    difficulty: Difficulty = "NORMAL",
    random: RandomSource = new BrowserRandom()
  ) {
    this.facade = new BelotMatchFacade(random, difficulty);
  }

  id() {
    return this.sessionId;
  }

  snapshot(): GameSnapshot {
    return this.facade.getSnapshot();
  }

  startMatch() {
    this.facade.startMatch();
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  updateLobbySettings(
    difficulty: Difficulty,
    playerNamesBySeat: PlayerNameDrafts,
    yourTeamName: string,
    enemyTeamName: string,
    matchTargetWins: MatchTargetWins,
    gameLength: GameLength
  ) {
    this.facade.updateLobbySettings(difficulty, playerNamesBySeat, yourTeamName, enemyTeamName, matchTargetWins, gameLength);
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  chooseTrump(choice: string) {
    this.facade.chooseTrump(choice as never);
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  reportMelds(declare: boolean) {
    this.facade.reportMelds(declare);
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  acknowledgeMelds() {
    this.facade.acknowledgeMelds();
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  playCard(handIndex: number, callBela = false) {
    this.facade.playCardWithBela(handIndex, callBela);
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  forfeitGame() {
    this.facade.forfeitGame();
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  forfeitMatch() {
    this.facade.forfeitMatch();
    this.broadcastNewEvents();
    return this.facade.getSnapshot();
  }

  eventsAfter(sequence: number) {
    return this.facade.getEventsAfter(sequence);
  }

  subscribe(afterSequence: number, listener: Listener) {
    this.listeners.add(listener);
    const backlog = this.facade.getEventsAfter(afterSequence);
    for (const event of backlog) {
      listener(event);
    }

    return {
      close: () => {
        this.listeners.delete(listener);
      }
    };
  }

  private broadcastNewEvents() {
    const newEvents = this.facade.getEventsAfter(this.broadcastSequence);
    if (newEvents.length === 0) {
      return;
    }

    for (const event of newEvents) {
      for (const listener of this.listeners) {
        listener(event);
      }
    }

    this.broadcastSequence = newEvents[newEvents.length - 1].sequence;
  }
}
