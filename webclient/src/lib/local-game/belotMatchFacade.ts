import type {
  Difficulty,
  GameLength,
  GameEvent,
  GameSnapshot,
  MeldCombinationView,
  MeldDeclarationView,
  MeldSetView,
  MeldWinnerView,
  MatchTargetWins,
  PendingAction,
  PlayedCardView,
  PlayerView,
  ScoreView,
  Suit,
  TrumpChoice
} from "../../types";
import {
  belaEligibleCardIndices,
  cardLabel,
  cardPoints,
  chooseCardForAi,
  chooseTrumpForAi,
  compareCards,
  createShuffledDeck,
  findWinningPlay,
  isBelaEligible,
  legalCardIndices,
  suitDisplayNames
} from "./aiAndRules";
import type {
  Card,
  MeldCombination,
  MeldSet,
  MeldWinner,
  PlayedCard,
  PlayerState,
  Seat,
  TeamSide,
  TeamState,
  TrickState
} from "./meldService";
import { determineWinningMeldWinner, evaluateMeldSet } from "./meldService";
import type { RandomSource } from "./random";
import { BrowserRandom } from "./random";

type ActionType = "NONE" | "START_MATCH" | "START_NEXT_GAME" | "CHOOSE_TRUMP" | "REPORT_MELDS" | "ACKNOWLEDGE_MELDS" | "PLAY_CARD";
type Phase = "READY_TO_START" | "BETWEEN_GAMES" | "TRUMP_SELECTION" | "TRICK_PLAY" | "MATCH_COMPLETE";

interface MatchState {
  difficulty: Difficulty;
  players: PlayerState[];
  teamOne: TeamState;
  teamTwo: TeamState;
  dealerIndex: number;
  currentPlayerIndex: number;
  trumpTurnOffset: number;
  gameNumber: number;
  matchTargetWins: MatchTargetWins;
  gameTargetPoints: number;
  deck: Card[];
  trumpSuit: Suit | null;
  declarer: TeamSide | null;
  declarerPlayerIndex: number | null;
  currentTrick: TrickState | null;
  lastWinningMeldSets: MeldSet[];
  declaredMeldSets: MeldSet[];
  humanMeldOffer: MeldSet | null;
  pendingMeldWinner: MeldWinnerView | null;
  firstTrickAnnounced: boolean;
  phase: Phase;
  pendingType: ActionType;
  pendingValidationMessage: string | null;
  pendingValidationCode: string | null;
}

const DEFAULT_MATCH_TARGET_WINS: MatchTargetWins = 3;
const FULL_HAND_SIZE = 8;
const OPENING_DEAL_SIZE = 6;
const LAST_TRICK_BONUS = 10;

export class BelotMatchFacade {
  private readonly random: RandomSource;
  private readonly events: GameEvent[] = [];
  private state: MatchState;
  private nextSequence = 1;

  constructor(random: RandomSource = new BrowserRandom(), difficulty: Difficulty = "NORMAL") {
    this.random = random;
    this.state = createMatchState(difficulty);
    this.createNewMatch(difficulty);
  }

  createNewMatch(difficulty: Difficulty) {
    this.events.length = 0;
    this.nextSequence = 1;
    this.state = createMatchState(difficulty);
    this.log("INFO", "New Belot session created.", { eventKind: "SESSION_CREATED", difficulty });
  }

  startMatch() {
    this.ensure(this.state.phase === "READY_TO_START" || this.state.phase === "BETWEEN_GAMES", "MATCH_RUNNING", "The match is already running.");
    this.clearValidation();
    if (this.state.phase === "READY_TO_START") {
      this.startNextGame(false);
    } else {
      this.startNextFullGame(true);
    }
    this.processUntilHumanTurn();
  }

  updatePlayerNames(playerNamesBySeat: Partial<Record<Seat, string>> | null | undefined) {
    this.ensure(this.state.phase === "READY_TO_START", "PLAYER_NAMES_LOCKED", "Player names can only be changed before the match starts.");
    if (!playerNamesBySeat || Object.keys(playerNamesBySeat).length === 0) {
      return;
    }

    for (const player of this.state.players) {
      const proposedName = playerNamesBySeat[player.seat];
      if (proposedName == null) {
        continue;
      }

      const sanitized = proposedName.trim();
      if (sanitized) {
        player.name = sanitized;
      }
    }

    this.log("INFO", "Player names updated.", { eventKind: "PLAYER_NAMES_UPDATED" });
  }

  updateTeamNames(yourTeamName: string | null | undefined, enemyTeamName: string | null | undefined) {
    this.ensure(this.state.phase === "READY_TO_START", "TEAM_NAMES_LOCKED", "Team names can only be changed before the match starts.");

    let changed = false;
    if (yourTeamName != null && yourTeamName.trim()) {
      this.state.teamOne.name = yourTeamName.trim();
      changed = true;
    }

    if (enemyTeamName != null && enemyTeamName.trim()) {
      this.state.teamTwo.name = enemyTeamName.trim();
      changed = true;
    }

    if (changed) {
      this.log("INFO", "Team names updated.", { eventKind: "TEAM_NAMES_UPDATED" });
    }
  }

  updateLobbySettings(
    difficulty: Difficulty | null | undefined,
    playerNamesBySeat: Partial<Record<Seat, string>> | null | undefined,
    yourTeamName: string | null | undefined,
    enemyTeamName: string | null | undefined,
    matchTargetWins: MatchTargetWins | null | undefined,
    gameLength: GameLength | null | undefined
  ) {
    this.ensure(this.state.phase === "READY_TO_START", "LOBBY_LOCKED", "Lobby settings can only be changed before the match starts.");
    if (difficulty) {
      this.state.difficulty = difficulty;
    }
    this.updateGameSettings(matchTargetWins, gameLength);
    this.updateTeamNames(yourTeamName, enemyTeamName);
    this.updatePlayerNames(playerNamesBySeat);
  }

  updateGameSettings(matchTargetWins: MatchTargetWins | null | undefined, gameLength: GameLength | null | undefined) {
    this.ensure(this.state.phase === "READY_TO_START", "GAME_SETTINGS_LOCKED", "Game settings can only be changed before the match starts.");
    if (matchTargetWins) {
      this.state.matchTargetWins = sanitizeMatchTargetWins(matchTargetWins);
    }
    if (gameLength) {
      this.state.gameTargetPoints = gameLength === "SHORT" ? 501 : 1001;
    }
  }

  chooseTrump(choice: TrumpChoice | null | undefined) {
    this.ensurePending("CHOOSE_TRUMP");
    this.clearValidation();

    if (!choice) {
      this.reject("CHOOSE_TRUMP", "Choose a trump suit or skip.");
    }

    if (choice === "SKIP" && this.state.trumpTurnOffset === 3) {
      this.reject("TRUMP_REQUIRED", "The last player must choose a trump suit.");
    }

    if (choice === "SKIP") {
      const player = this.currentPlayer();
      this.log("ACTION", `${player.name} skipped trump selection.`, {
        eventKind: "TRUMP_SKIP",
        playerId: player.id,
        playerName: player.name,
        playerSeat: player.seat
      });
      this.advanceTrumpTurn();
      this.processUntilHumanTurn();
      return;
    }

    this.selectTrump(this.currentPlayer(), choice);
    this.processUntilHumanTurn();
  }

  playCard(handIndex: number) {
    this.playCardWithBela(handIndex, false);
  }

  playCardWithBela(handIndex: number, callBela = false) {
    this.ensurePending("PLAY_CARD");
    this.clearValidation();

    const legal = legalCardIndices(this.currentPlayer(), this.state.currentTrick?.cards ?? [], this.state.trumpSuit);
    if (!legal.includes(handIndex)) {
      this.reject("ILLEGAL_CARD", "That card is not legal in the current trick.");
    }

    this.playCardInternal(handIndex, callBela);
    this.processUntilHumanTurn();
  }

  forfeitGame() {
    this.ensure(this.state.phase !== "READY_TO_START", "GAME_NOT_STARTED", "Start the match before forfeiting a game.");
    this.ensure(this.state.phase !== "BETWEEN_GAMES", "GAME_COMPLETE", "The current game is already complete.");
    this.ensure(this.state.phase !== "MATCH_COMPLETE", "MATCH_COMPLETE", "The match is already complete.");

    this.clearValidation();

    const forfeitingTeam = this.state.teamOne;
    const winningTeam = this.state.teamTwo;
    winningTeam.gameScore = Math.max(winningTeam.gameScore, this.state.gameTargetPoints);
    this.clearCurrentHandState();

    this.log("INFO", `${forfeitingTeam.name} forfeited the game. ${winningTeam.name} won by forfeit.`, {
      eventKind: "GAME_FORFEIT",
      forfeitingTeam: forfeitingTeam.name,
      winner: winningTeam.name,
      winningScore: String(winningTeam.gameScore),
      gameNumber: String(this.state.gameNumber)
    });

    this.finalizeGameWin(winningTeam, true);
  }

  forfeitMatch() {
    this.ensure(this.state.phase !== "READY_TO_START", "MATCH_NOT_STARTED", "Start the match before forfeiting it.");
    this.ensure(this.state.phase !== "MATCH_COMPLETE", "MATCH_COMPLETE", "The match is already complete.");

    this.clearValidation();

    const gameInProgress = this.state.phase !== "BETWEEN_GAMES";
    const forfeitingTeam = this.state.teamOne;
    const winningTeam = this.state.teamTwo;
    if (gameInProgress) winningTeam.gameScore = Math.max(winningTeam.gameScore, this.state.gameTargetPoints);
    winningTeam.matchWins = this.state.matchTargetWins;
    if (gameInProgress) this.clearCurrentHandState();

    this.log("INFO", `${forfeitingTeam.name} forfeited the match. ${winningTeam.name} won by forfeit.`, {
      eventKind: "MATCH_FORFEIT",
      forfeitingTeam: forfeitingTeam.name,
      winner: winningTeam.name,
      winningScore: String(winningTeam.gameScore),
      gameNumber: String(this.state.gameNumber)
    });
    if (gameInProgress) {
      this.log("INFO", `${winningTeam.name} won the game.`, {
        eventKind: "GAME_WIN",
        winner: winningTeam.name,
        winningScore: String(winningTeam.gameScore),
        matchWins: String(winningTeam.matchWins),
        gameNumber: String(this.state.gameNumber),
        byForfeit: "true"
      });
    }

    this.state.phase = "MATCH_COMPLETE";
    this.state.pendingType = "NONE";
    this.state.pendingValidationMessage = null;
    this.state.pendingValidationCode = null;
    this.state.currentTrick = null;
    this.log("INFO", `${winningTeam.name} won the match.`, {
      eventKind: "MATCH_WIN",
      winner: winningTeam.name,
      matchWins: String(winningTeam.matchWins),
      gameNumber: String(this.state.gameNumber),
      byForfeit: "true"
    });
  }

  reportMelds(declare: boolean) {
    this.ensurePending("REPORT_MELDS");
    this.clearValidation();

    const meldOffer = this.state.humanMeldOffer;
    if (!meldOffer || meldOffer.totalPoints === 0) {
      this.reject("NO_MELDS", "There are no melds to report.");
    }

    if (declare) {
      this.state.declaredMeldSets.push(meldOffer);
      this.log("INFO", `${meldOffer.player.name} declared melds.`, {
        eventKind: "MELDS_DECLARE",
        playerId: meldOffer.player.id,
        playerName: meldOffer.player.name,
        playerSeat: meldOffer.player.seat,
        team: meldOffer.player.team.name,
        points: String(meldOffer.totalPoints)
      });
    } else {
      this.log("INFO", `${meldOffer.player.name} passed on melds.`, {
        eventKind: "MELDS_PASS",
        playerId: meldOffer.player.id,
        playerName: meldOffer.player.name,
        playerSeat: meldOffer.player.seat
      });
    }

    this.state.humanMeldOffer = null;
    this.finalizeMeldDeclarations();
    this.processUntilHumanTurn();
  }

  acknowledgeMelds() {
    this.ensurePending("ACKNOWLEDGE_MELDS");
    this.clearValidation();
    this.state.pendingMeldWinner = null;
    this.state.pendingType = "NONE";
    this.processUntilHumanTurn();
  }

  getSnapshot(): GameSnapshot {
    const pendingAction = this.buildPendingAction();
    const legalIndices = pendingAction.type === "PLAY_CARD" ? pendingAction.legalCardIndices : [];
    const players = this.state.players.map((player) => this.toPlayerView(player, legalIndices));
    const score: ScoreView = {
      teamOneName: this.state.teamOne.name,
      teamOneMatchScore: this.state.teamOne.matchWins,
      teamOneGamePoints: this.displayedGameScore(this.state.teamOne),
      teamTwoName: this.state.teamTwo.name,
      teamTwoMatchScore: this.state.teamTwo.matchWins,
      teamTwoGamePoints: this.displayedGameScore(this.state.teamTwo),
      declarerTeam: this.state.declarer ? this.teamFor(this.state.declarer).name : null,
      gameNumber: this.state.gameNumber,
      difficulty: this.state.difficulty,
      matchTargetWins: this.state.matchTargetWins,
      gameTargetPoints: this.state.gameTargetPoints,
      teamOneMeldPoints: this.state.teamOne.meldPoints,
      teamTwoMeldPoints: this.state.teamTwo.meldPoints,
      meldDeclarations: this.meldDeclarations()
    };

    return {
      phase: this.state.phase,
      trumpSuit: this.state.trumpSuit,
      dealerPlayerId: this.playerAt(this.state.dealerIndex).id,
      declarerPlayerId: this.state.declarerPlayerIndex == null ? null : this.playerAt(this.state.declarerPlayerIndex).id,
      currentPlayerId:
        this.state.phase === "READY_TO_START" || this.state.phase === "BETWEEN_GAMES" || this.state.phase === "MATCH_COMPLETE"
          ? null
          : this.currentPlayer().id,
      players,
      trick: {
        leadPlayerId: this.state.currentTrick == null ? null : this.playerAt(this.state.currentTrick.leadPlayerIndex).id,
        cards: this.state.currentTrick == null ? [] : this.state.currentTrick.cards.map((playedCard) => this.toPlayedCardView(playedCard))
      },
      score,
      pendingAction,
      lastEventSequence: this.nextSequence - 1,
      matchComplete: this.state.phase === "MATCH_COMPLETE"
    };
  }

  getEventsAfter(sequence: number) {
    return this.events.filter((event) => event.sequence > sequence);
  }

  private processUntilHumanTurn() {
    while (true) {
      if (this.state.phase === "MATCH_COMPLETE" || this.state.phase === "READY_TO_START" || this.state.phase === "BETWEEN_GAMES") {
        return;
      }

      if (this.state.pendingType === "REPORT_MELDS" || this.state.pendingType === "ACKNOWLEDGE_MELDS") {
        return;
      }

      if (this.state.phase === "TRUMP_SELECTION") {
        const player = this.currentPlayer();
        if (player.human) {
          this.state.pendingType = "CHOOSE_TRUMP";
          return;
        }

        const choice = chooseTrumpForAi(player, this.state.trumpTurnOffset === 3, this.state.difficulty);
        if (choice === "SKIP") {
          this.log("ACTION", `${player.name} skipped trump selection.`, {
            eventKind: "TRUMP_SKIP",
            playerId: player.id,
            playerName: player.name,
            playerSeat: player.seat
          });
          this.advanceTrumpTurn();
          continue;
        }

        this.selectTrump(player, choice);
        continue;
      }

      if (this.state.players.every((player) => player.hand.length === 0)) {
        this.finishGame();
        continue;
      }

      if (!this.state.firstTrickAnnounced && this.state.currentTrick && this.state.currentTrick.cards.length === 0) {
        this.state.firstTrickAnnounced = true;
        this.log("INFO", `${this.playerAt(this.state.currentPlayerIndex).name} leads the first trick.`, {
          eventKind: "TRICK_LEAD",
          playerName: this.playerAt(this.state.currentPlayerIndex).name,
          playerId: this.playerAt(this.state.currentPlayerIndex).id,
          playerSeat: this.playerAt(this.state.currentPlayerIndex).seat
        });
      }

      const player = this.currentPlayer();
      const legal = legalCardIndices(player, this.state.currentTrick?.cards ?? [], this.state.trumpSuit);
      if (player.human) {
        this.state.pendingType = "PLAY_CARD";
        return;
      }

      const chosenIndex = chooseCardForAi(
        player,
        legal,
        this.state.currentTrick?.cards ?? [],
        this.state.trumpSuit,
        this.state.difficulty,
        this.random
      );
      this.playCardInternal(chosenIndex, belaEligibleCardIndices(player, this.state.trumpSuit).includes(chosenIndex));
    }
  }

  private playCardInternal(handIndex: number, callBela: boolean) {
    const player = this.currentPlayer();
    const belaEligible = isBelaEligible(player, handIndex, this.state.trumpSuit);
    if (callBela && !belaEligible) {
      this.reject("BELA_NOT_ALLOWED", "Bela cannot be called with that card.");
    }

    const [card] = player.hand.splice(handIndex, 1);
    if (!card) {
      this.reject("ILLEGAL_CARD", "That card is not legal in the current trick.");
    }

    if (belaEligible) {
      player.belaResolved = true;
      if (callBela) {
        player.belaCalled = true;
        player.team.meldPoints += 20;
        this.log("INFO", `${player.name} called Bela.`, {
          eventKind: "BELA_CALL",
          playerId: player.id,
          playerName: player.name,
          playerSeat: player.seat,
          team: player.team.name,
          points: "20"
        });
      }
    }

    this.state.currentTrick?.cards.push({ playerIndex: player.index, card });
    this.log("ACTION", `${player.name} played ${cardLabel(card)}.`, {
      eventKind: "PLAY_CARD",
      playerId: player.id,
      playerName: player.name,
      playerSeat: player.seat,
      card: cardLabel(card),
      rank: card.rank,
      suit: card.suit
    });

    if ((this.state.currentTrick?.cards.length ?? 0) < this.state.players.length) {
      this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
      this.state.pendingType = "NONE";
      return;
    }

    this.resolveTrick();
  }

  private resolveTrick() {
    const currentTrick = this.state.currentTrick;
    if (!currentTrick || !this.state.trumpSuit) {
      throw new Error("Cannot resolve trick without current trick and trump.");
    }

    const winningPlay = findWinningPlay(currentTrick.cards, this.state.trumpSuit);
    if (!winningPlay) {
      throw new Error("Cannot resolve empty trick.");
    }

    const winner = this.playerAt(winningPlay.playerIndex);
    let trickPoints = currentTrick.cards.reduce((total, play) => total + cardPoints(play.card, this.state.trumpSuit), 0);
    winner.team.trickPoints += trickPoints;
    winner.team.tricksWon += 1;

    const lastTrick = this.state.players.every((player) => player.hand.length === 0);
    let lastTrickBonus = 0;
    if (lastTrick) {
      winner.team.trickPoints += LAST_TRICK_BONUS;
      trickPoints += LAST_TRICK_BONUS;
      lastTrickBonus = LAST_TRICK_BONUS;
    }

    this.log("SCORE", `${winner.name} won the trick for ${trickPoints} points.`, {
      eventKind: "TRICK_WIN",
      winnerPlayerId: winner.id,
      winnerPlayerName: winner.name,
      winnerSeat: winner.seat,
      playerId: winner.id,
      team: winner.team.name,
      trickPoints: String(trickPoints),
      lastTrickBonus: String(lastTrickBonus),
      trickCardCount: String(currentTrick.cards.length)
    });

    if (lastTrick) {
      this.finishGame();
      return;
    }

    this.state.currentPlayerIndex = winner.index;
    this.state.currentTrick = {
      leadPlayerIndex: winner.index,
      cards: []
    };
    this.state.pendingType = "NONE";
  }

  private finishGame() {
    const teamOnePoints = this.teamHandPoints(this.state.teamOne);
    const teamTwoPoints = this.teamHandPoints(this.state.teamTwo);
    const declarer = this.state.declarer ? this.teamFor(this.state.declarer) : null;
    const defenders = this.state.declarer ? this.otherTeam(this.state.declarer) : null;
    const totalPoints = teamOnePoints + teamTwoPoints;

    if (!declarer || !defenders) {
      throw new Error("Cannot finish game without declarer.");
    }

    if (this.teamHandPoints(declarer) > this.teamHandPoints(defenders)) {
      this.state.teamOne.gameScore += teamOnePoints;
      this.state.teamTwo.gameScore += teamTwoPoints;
      this.log("SCORE", `${declarer.name} passed the hand.`, {
        eventKind: "HAND_PASSED",
        team: declarer.name,
        teamOneName: this.state.teamOne.name,
        teamTwoName: this.state.teamTwo.name,
        teamOnePoints: String(teamOnePoints),
        teamTwoPoints: String(teamTwoPoints),
        gameNumber: String(this.state.gameNumber),
        dealerPlayerName: this.playerAt(this.state.dealerIndex).name,
        trumpPlayerName: this.playerAt(this.state.declarerPlayerIndex!).name,
        trump: this.state.trumpSuit!,
        meldWinner: this.state.lastWinningMeldSets[0]?.player.team.name ?? "",
        meldPoints: String(this.state.lastWinningMeldSets.reduce((total, meldSet) => total + meldSet.totalPoints, 0))
      });
    } else {
      defenders.gameScore += totalPoints;
      const teamOneAward = defenders === this.state.teamOne ? totalPoints : 0;
      const teamTwoAward = defenders === this.state.teamTwo ? totalPoints : 0;
      this.log("SCORE", `${declarer.name} failed the hand. ${defenders.name} collected all ${totalPoints} points.`, {
        eventKind: "HAND_FAILED",
        team: declarer.name,
        winner: defenders.name,
        points: String(totalPoints),
        teamOneName: this.state.teamOne.name,
        teamTwoName: this.state.teamTwo.name,
        teamOnePoints: String(teamOneAward),
        teamTwoPoints: String(teamTwoAward),
        gameNumber: String(this.state.gameNumber),
        dealerPlayerName: this.playerAt(this.state.dealerIndex).name,
        trumpPlayerName: this.playerAt(this.state.declarerPlayerIndex!).name,
        trump: this.state.trumpSuit!,
        meldWinner: this.state.lastWinningMeldSets[0]?.player.team.name ?? "",
        meldPoints: String(this.state.lastWinningMeldSets.reduce((total, meldSet) => total + meldSet.totalPoints, 0))
      });
    }

    const winner = this.state.teamOne.gameScore >= this.state.teamTwo.gameScore ? this.state.teamOne : this.state.teamTwo;
    if (winner.gameScore >= this.state.gameTargetPoints) {
      this.finalizeGameWin(winner, false);
      return;
    }

    this.startNextGame(true);
  }

  private finalizeGameWin(winner: TeamState, byForfeit: boolean) {
    winner.matchWins += 1;
    this.log("INFO", `${winner.name} won the game.`, {
      eventKind: "GAME_WIN",
      winner: winner.name,
      winningScore: String(winner.gameScore),
      matchWins: String(winner.matchWins),
      gameNumber: String(this.state.gameNumber),
      byForfeit: String(byForfeit)
    });

    if (winner.matchWins >= this.state.matchTargetWins) {
      this.state.phase = "MATCH_COMPLETE";
      this.state.pendingType = "NONE";
      this.log("INFO", `${winner.name} won the match.`, {
        eventKind: "MATCH_WIN",
        winner: winner.name,
        matchWins: String(winner.matchWins),
        gameNumber: String(this.state.gameNumber),
        byForfeit: String(byForfeit)
      });
      return;
    }

    this.state.phase = "BETWEEN_GAMES";
    this.state.pendingType = "START_NEXT_GAME";
    this.state.pendingValidationMessage = null;
    this.state.pendingValidationCode = null;
    this.state.currentTrick = null;
  }

  private startNextFullGame(rotateDealer: boolean) {
    this.state.teamOne.gameScore = 0;
    this.state.teamTwo.gameScore = 0;
    this.state.gameNumber += 1;
    this.startNextHand(rotateDealer);
    this.log("INFO", `Game ${this.state.gameNumber} started. ${this.playerAt(this.state.dealerIndex).name} is the dealer.`, {
      eventKind: "GAME_START",
      gameNumber: String(this.state.gameNumber),
      dealerPlayerName: this.playerAt(this.state.dealerIndex).name,
      dealerPlayerId: this.playerAt(this.state.dealerIndex).id
    });
  }

  private startNextGame(rotateDealer: boolean) {
    if (this.state.gameNumber === 0) {
      this.startNextFullGame(rotateDealer);
      return;
    }

    this.startNextHand(rotateDealer);
  }

  private startNextHand(rotateDealer: boolean) {
    if (rotateDealer) {
      this.state.dealerIndex = (this.state.dealerIndex + 1) % this.state.players.length;
    }

    this.clearCurrentHandState();
    this.state.phase = "TRUMP_SELECTION";
    this.state.pendingType = "NONE";
    this.state.pendingValidationMessage = null;
    this.state.pendingValidationCode = null;
    this.state.currentPlayerIndex = (this.state.dealerIndex + 1) % this.state.players.length;
    this.state.deck = createShuffledDeck(this.random);
    this.dealCards(OPENING_DEAL_SIZE);
  }

  private selectTrump(player: PlayerState, suit: Suit) {
    this.state.trumpSuit = suit;
    this.state.declarer = player.team.side;
    this.state.declarerPlayerIndex = player.index;
    this.log("ACTION", `${player.name} chose ${suitDisplayNames[suit]} as trump.`, {
      eventKind: "TRUMP_CHOSEN",
      playerId: player.id,
      playerName: player.name,
      playerSeat: player.seat,
      trump: suit
    });

    this.dealCards(FULL_HAND_SIZE - OPENING_DEAL_SIZE);
    for (const participant of this.state.players) {
      participant.hand.sort(compareCards);
    }

    this.state.currentPlayerIndex = (this.state.dealerIndex + 1) % this.state.players.length;
    this.state.currentTrick = {
      leadPlayerIndex: this.state.currentPlayerIndex,
      cards: []
    };
    this.state.phase = "TRICK_PLAY";
    this.state.pendingType = "NONE";
    this.setupMeldFlow();
  }

  private dealCards(count: number) {
    for (let round = 0; round < count; round += 1) {
      for (let offset = 0; offset < this.state.players.length; offset += 1) {
        const player = this.playerAt((this.state.dealerIndex + 1 + offset) % this.state.players.length);
        const card = this.state.deck.shift();
        if (!card) {
          throw new Error("Deck exhausted.");
        }
        player.hand.push(card);
      }
    }
  }

  private setupMeldFlow() {
    this.state.declaredMeldSets = [];
    this.state.lastWinningMeldSets = [];
    this.state.pendingMeldWinner = null;
    this.state.humanMeldOffer = null;

    for (const player of this.state.players) {
      const meldSet = evaluateMeldSet(player, this.state.trumpSuit!);
      if (meldSet.totalPoints === 0) {
        continue;
      }

      if (player.human) {
        this.state.humanMeldOffer = meldSet;
      } else {
        this.state.declaredMeldSets.push(meldSet);
        this.log("INFO", `${player.name} declared melds.`, {
          eventKind: "MELDS_DECLARE",
          playerId: player.id,
          playerName: player.name,
          playerSeat: player.seat,
          team: player.team.name,
          points: String(meldSet.totalPoints)
        });
      }
    }

    if (this.state.humanMeldOffer) {
      this.state.pendingType = "REPORT_MELDS";
      return;
    }

    this.finalizeMeldDeclarations();
  }

  private finalizeMeldDeclarations() {
    const winner = determineWinningMeldWinner(this.state.declaredMeldSets, this.state.declarer, (side) => this.teamFor(side).name);
    if (!winner) {
      this.state.lastWinningMeldSets = [];
      this.state.pendingMeldWinner = null;
      this.state.pendingType = "NONE";
      return;
    }

    this.state.lastWinningMeldSets = winner.players;
    this.state.pendingMeldWinner = this.toMeldWinnerView(winner);
    this.teamFor(winner.team).meldPoints += winner.totalPoints;
    this.log("INFO", `${winner.teamName} took melds.`, {
      eventKind: "MELDS_WIN",
      team: winner.teamName,
      points: String(winner.totalPoints)
    });
    this.state.pendingType = "ACKNOWLEDGE_MELDS";
  }

  private teamHandPoints(team: TeamState) {
    return team.tricksWon === 0 ? 0 : team.trickPoints + team.meldPoints;
  }

  private buildPendingAction(): PendingAction {
    switch (this.state.pendingType) {
      case "START_MATCH":
        return {
          type: "START_MATCH",
          actingPlayerId: this.playerAt(0).id,
          legalCardIndices: [],
          legalTrumpChoices: [],
          belaEligibleCardIndices: [],
          availableMelds: [],
          meldWinner: null,
          validationMessage: this.state.pendingValidationMessage,
          validationCode: this.state.pendingValidationCode,
          prompt: "Start the match."
        };
      case "START_NEXT_GAME":
        return {
          type: "START_NEXT_GAME",
          actingPlayerId: this.playerAt(0).id,
          legalCardIndices: [],
          legalTrumpChoices: [],
          belaEligibleCardIndices: [],
          availableMelds: [],
          meldWinner: null,
          validationMessage: this.state.pendingValidationMessage,
          validationCode: this.state.pendingValidationCode,
          prompt: "Start the next game."
        };
      case "CHOOSE_TRUMP":
        return {
          type: "CHOOSE_TRUMP",
          actingPlayerId: this.currentPlayer().id,
          legalCardIndices: [],
          legalTrumpChoices:
            this.state.trumpTurnOffset === 3
              ? ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"]
              : ["SKIP", "SPADES", "HEARTS", "DIAMONDS", "CLUBS"],
          belaEligibleCardIndices: [],
          availableMelds: [],
          meldWinner: null,
          validationMessage: this.state.pendingValidationMessage,
          validationCode: this.state.pendingValidationCode,
          prompt: this.state.trumpTurnOffset === 3 ? "Choose the trump suit." : "Choose the trump suit or skip."
        };
      case "REPORT_MELDS":
        return {
          type: "REPORT_MELDS",
          actingPlayerId: this.state.humanMeldOffer?.player.id ?? this.playerAt(0).id,
          legalCardIndices: [],
          legalTrumpChoices: [],
          belaEligibleCardIndices: [],
          availableMelds: this.state.humanMeldOffer ? [this.toMeldSetView(this.state.humanMeldOffer)] : [],
          meldWinner: null,
          validationMessage: this.state.pendingValidationMessage,
          validationCode: this.state.pendingValidationCode,
          prompt: "Declare melds or pass."
        };
      case "ACKNOWLEDGE_MELDS":
        return {
          type: "ACKNOWLEDGE_MELDS",
          actingPlayerId: this.playerAt(0).id,
          legalCardIndices: [],
          legalTrumpChoices: [],
          belaEligibleCardIndices: [],
          availableMelds: [],
          meldWinner: this.state.pendingMeldWinner,
          validationMessage: this.state.pendingValidationMessage,
          validationCode: this.state.pendingValidationCode,
          prompt: "Review the melds and continue."
        };
      case "PLAY_CARD":
        return {
          type: "PLAY_CARD",
          actingPlayerId: this.currentPlayer().id,
          legalCardIndices: legalCardIndices(this.currentPlayer(), this.state.currentTrick?.cards ?? [], this.state.trumpSuit),
          legalTrumpChoices: [],
          belaEligibleCardIndices: belaEligibleCardIndices(this.currentPlayer(), this.state.trumpSuit),
          availableMelds: [],
          meldWinner: null,
          validationMessage: this.state.pendingValidationMessage,
          validationCode: this.state.pendingValidationCode,
          prompt: "Play a legal card."
        };
      case "NONE":
      default:
        return {
          type: "NONE",
          actingPlayerId: null,
          legalCardIndices: [],
          legalTrumpChoices: [],
          belaEligibleCardIndices: [],
          availableMelds: [],
          meldWinner: null,
          validationMessage: this.state.pendingValidationMessage,
          validationCode: this.state.pendingValidationCode,
          prompt: ""
        };
    }
  }

  private toPlayerView(player: PlayerState, legalIndices: number[]): PlayerView {
    const hand = player.human
      ? player.hand.map((card, index) => ({
          suit: card.suit,
          rank: card.rank,
          label: cardLabel(card),
          faceUp: true,
          playable: legalIndices.includes(index)
        }))
      : player.hand.map(() => ({
          suit: null,
          rank: null,
          label: "Hidden",
          faceUp: false,
          playable: false
        }));

    return {
      id: player.id,
      name: player.name,
      seat: player.seat,
      human: player.human,
      team: player.team.name,
      hand,
      handSize: player.hand.length,
      matchScore: player.team.matchWins,
      gamePoints: this.displayedGameScore(player.team),
      dealer: player.index === this.state.dealerIndex,
      currentTurn:
        this.state.phase !== "READY_TO_START" &&
        this.state.phase !== "BETWEEN_GAMES" &&
        this.state.phase !== "MATCH_COMPLETE" &&
        player.index === this.state.currentPlayerIndex
    };
  }

  private toPlayedCardView(playedCard: PlayedCard): PlayedCardView {
    const player = this.playerAt(playedCard.playerIndex);
    return {
      playerId: player.id,
      playerName: player.name,
      seat: player.seat,
      card: {
        suit: playedCard.card.suit,
        rank: playedCard.card.rank,
        label: cardLabel(playedCard.card),
        faceUp: true,
        playable: false
      }
    };
  }

  private meldDeclarations(): MeldDeclarationView[] {
    return this.state.players.flatMap((player) => {
      const meldSet = this.state.lastWinningMeldSets.find((set) => set.player === player);
      if (!meldSet && !player.belaCalled) return [];
      return [
        {
          playerId: player.id,
          playerName: player.name,
          teamName: player.team.name,
          meldPoints: meldSet?.totalPoints ?? 0,
          belaPoints: player.belaCalled ? 20 : 0,
          labels: meldSet?.melds.map((meld) => meld.label) ?? [],
          melds: meldSet?.melds.map((meld) => this.toMeldCombinationView(meld)) ?? []
        }
      ];
    });
  }

  private advanceTrumpTurn() {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    this.state.trumpTurnOffset += 1;
    this.state.pendingType = "NONE";
  }

  private ensurePending(expected: ActionType) {
    this.ensure(this.state.pendingType === expected, "UNEXPECTED_ACTION", "That action is not expected right now.");
  }

  private ensure(condition: boolean, code: string, message: string) {
    if (!condition) {
      this.reject(code, message);
    }
  }

  private reject(code: string, message: string): never {
    this.state.pendingValidationMessage = message;
    this.state.pendingValidationCode = code;
    this.log("ERROR", message, { eventKind: "ERROR", code });
    throw Object.assign(new Error(message), { code });
  }

  private clearValidation() {
    this.state.pendingValidationMessage = null;
    this.state.pendingValidationCode = null;
  }

  private log(type: string, message: string, payload: Record<string, string>) {
    this.events.push({
      sequence: this.nextSequence,
      type,
      message,
      createdAt: new Date().toISOString(),
      payload
    });
    this.nextSequence += 1;
  }

  private currentPlayer() {
    return this.playerAt(this.state.currentPlayerIndex);
  }

  private playerAt(index: number) {
    const player = this.state.players[index];
    if (!player) {
      throw new Error(`Unknown player index ${index}.`);
    }
    return player;
  }

  private teamFor(side: TeamSide) {
    return side === "YOURS" ? this.state.teamOne : this.state.teamTwo;
  }

  private otherTeam(side: TeamSide) {
    return side === "YOURS" ? this.state.teamTwo : this.state.teamOne;
  }

  private clearCurrentHandState() {
    this.state.trumpSuit = null;
    this.state.declarer = null;
    this.state.declarerPlayerIndex = null;
    this.state.trumpTurnOffset = 0;
    this.state.currentTrick = null;
    this.state.lastWinningMeldSets = [];
    this.state.declaredMeldSets = [];
    this.state.humanMeldOffer = null;
    this.state.pendingMeldWinner = null;
    this.state.firstTrickAnnounced = false;
    this.state.teamOne.trickPoints = 0;
    this.state.teamOne.tricksWon = 0;
    this.state.teamOne.meldPoints = 0;
    this.state.teamTwo.trickPoints = 0;
    this.state.teamTwo.tricksWon = 0;
    this.state.teamTwo.meldPoints = 0;

    for (const player of this.state.players) {
      player.hand = [];
      player.belaCalled = false;
      player.belaResolved = false;
    }
  }

  private displayedGameScore(team: TeamState) {
    if (this.state.phase === "BETWEEN_GAMES" || this.state.phase === "MATCH_COMPLETE") {
      return team.gameScore;
    }
    return team.gameScore + this.teamHandPoints(team);
  }

  private toMeldSetView(meldSet: MeldSet): MeldSetView {
    return {
      playerId: meldSet.player.id,
      playerName: meldSet.player.name,
      teamName: meldSet.player.team.name,
      totalPoints: meldSet.totalPoints,
      melds: meldSet.melds.map((meld) => this.toMeldCombinationView(meld))
    };
  }

  private toMeldCombinationView(meld: MeldCombination): MeldCombinationView {
    return {
      kind: meld.kind,
      label: meld.label,
      points: meld.points,
      comparisonValue: meld.comparisonValue,
      cards: meld.cards.map((card) => ({
        suit: card.suit,
        rank: card.rank,
        label: cardLabel(card),
        faceUp: true,
        playable: false
      }))
    };
  }

  private toMeldWinnerView(meldWinner: MeldWinner): MeldWinnerView {
    return {
      teamName: meldWinner.teamName,
      players: meldWinner.players.map((meldSet) => this.toMeldSetView(meldSet))
    };
  }
}

function createMatchState(difficulty: Difficulty): MatchState {
  const yourTeam: TeamState = {
    side: "YOURS",
    name: "Us",
    matchWins: 0,
    gameScore: 0,
    trickPoints: 0,
    tricksWon: 0,
    meldPoints: 0
  };
  const enemyTeam: TeamState = {
    side: "ENEMIES",
    name: "Them",
    matchWins: 0,
    gameScore: 0,
    trickPoints: 0,
    tricksWon: 0,
    meldPoints: 0
  };

  return {
    difficulty,
    players: [
      { index: 0, id: "south", name: "You", seat: "SOUTH", human: true, team: yourTeam, hand: [] },
      { index: 1, id: "west", name: "Zapad", seat: "WEST", human: false, team: enemyTeam, hand: [] },
      { index: 2, id: "north", name: "Ti", seat: "NORTH", human: false, team: yourTeam, hand: [] },
      { index: 3, id: "east", name: "Istok", seat: "EAST", human: false, team: enemyTeam, hand: [] }
    ],
    teamOne: yourTeam,
    teamTwo: enemyTeam,
    dealerIndex: 3,
    currentPlayerIndex: 0,
    trumpTurnOffset: 0,
    gameNumber: 0,
    matchTargetWins: DEFAULT_MATCH_TARGET_WINS,
    gameTargetPoints: 1001,
    deck: [],
    trumpSuit: null,
    declarer: null,
    declarerPlayerIndex: null,
    currentTrick: null,
    lastWinningMeldSets: [],
    declaredMeldSets: [],
    humanMeldOffer: null,
    pendingMeldWinner: null,
    firstTrickAnnounced: false,
    phase: "READY_TO_START",
    pendingType: "START_MATCH",
    pendingValidationCode: null,
    pendingValidationMessage: null
  };
}

function sanitizeMatchTargetWins(matchTargetWins: number): MatchTargetWins {
  return matchTargetWins === 1 || matchTargetWins === 3 || matchTargetWins === 5 ? matchTargetWins : DEFAULT_MATCH_TARGET_WINS;
}
