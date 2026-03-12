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
  ScoreView
} from "../../types";
import type { RandomSource } from "./random";
import { BrowserRandom } from "./random";

type ActionType = "NONE" | "START_MATCH" | "START_NEXT_GAME" | "CHOOSE_TRUMP" | "REPORT_MELDS" | "ACKNOWLEDGE_MELDS" | "PLAY_CARD";
type Phase = "READY_TO_START" | "BETWEEN_GAMES" | "TRUMP_SELECTION" | "TRICK_PLAY" | "MATCH_COMPLETE";
type TeamSide = "YOURS" | "ENEMIES";
type Seat = "SOUTH" | "WEST" | "NORTH" | "EAST";
type Suit = "SPADES" | "HEARTS" | "DIAMONDS" | "CLUBS";
type Rank = "SEVEN" | "EIGHT" | "NINE" | "TEN" | "JACK" | "QUEEN" | "KING" | "ACE";
type TrumpChoice = Suit | "SKIP";

interface Card {
  suit: Suit;
  rank: Rank;
}

interface PlayedCard {
  playerIndex: number;
  card: Card;
}

interface TeamState {
  side: TeamSide;
  name: string;
  matchWins: number;
  gameScore: number;
  trickPoints: number;
  meldPoints: number;
}

interface PlayerState {
  index: number;
  id: string;
  name: string;
  seat: Seat;
  human: boolean;
  team: TeamState;
  hand: Card[];
  belaCalled?: boolean;
  belaResolved?: boolean;
}

interface TrickState {
  leadPlayerIndex: number;
  cards: PlayedCard[];
}

interface MeldCombination {
  kind: string;
  label: string;
  points: number;
  comparisonValue: number;
  cards: Card[];
}

interface MeldSet {
  player: PlayerState;
  melds: MeldCombination[];
  totalPoints: number;
  strongestComparisonValue: number;
}

interface MeldWinner {
  team: TeamSide;
  teamName: string;
  players: MeldSet[];
  totalPoints: number;
}

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
}

const DEFAULT_MATCH_TARGET_WINS: MatchTargetWins = 3;
const FULL_HAND_SIZE = 8;
const OPENING_DEAL_SIZE = 6;
const LAST_TRICK_BONUS = 10;
const SUITS: Suit[] = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];
const RANKS: Rank[] = ["SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN", "KING", "ACE"];
const suitSymbols: Record<Suit, string> = {
  SPADES: "S",
  HEARTS: "H",
  DIAMONDS: "D",
  CLUBS: "C"
};
const suitDisplayNames: Record<Suit, string> = {
  SPADES: "Spades",
  HEARTS: "Hearts",
  DIAMONDS: "Diamonds",
  CLUBS: "Clubs"
};
const rankSymbols: Record<Rank, string> = {
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  TEN: "10",
  JACK: "J",
  QUEEN: "Q",
  KING: "K",
  ACE: "A"
};

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
    this.log("INFO", "New Belot session created.", { difficulty });
  }

  startMatch() {
    this.ensure(this.state.phase === "READY_TO_START" || this.state.phase === "BETWEEN_GAMES", "The match is already running.");
    this.clearValidation();
    if (this.state.phase === "READY_TO_START") {
      this.startNextGame(false);
    } else {
      this.startNextFullGame(true);
    }
    this.processUntilHumanTurn();
  }

  updatePlayerNames(playerNamesBySeat: Partial<Record<Seat, string>> | null | undefined) {
    this.ensure(this.state.phase === "READY_TO_START", "Player names can only be changed before the match starts.");
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

    this.log("INFO", "Player names updated.", {});
  }

  updateTeamNames(yourTeamName: string | null | undefined, enemyTeamName: string | null | undefined) {
    this.ensure(this.state.phase === "READY_TO_START", "Team names can only be changed before the match starts.");

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
      this.log("INFO", "Team names updated.", {});
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
    this.ensure(this.state.phase === "READY_TO_START", "Lobby settings can only be changed before the match starts.");
    if (difficulty) {
      this.state.difficulty = difficulty;
    }
    this.updateGameSettings(matchTargetWins, gameLength);
    this.updateTeamNames(yourTeamName, enemyTeamName);
    this.updatePlayerNames(playerNamesBySeat);
  }

  updateGameSettings(matchTargetWins: MatchTargetWins | null | undefined, gameLength: GameLength | null | undefined) {
    this.ensure(this.state.phase === "READY_TO_START", "Game settings can only be changed before the match starts.");
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
      this.reject("Choose a trump suit or skip.");
    }

    if (choice === "SKIP" && this.state.trumpTurnOffset === 3) {
      this.reject("The last player must choose a trump suit.");
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
      this.reject("That card is not legal in the current trick.");
    }

    this.playCardInternal(handIndex, callBela);
    this.processUntilHumanTurn();
  }

  reportMelds(declare: boolean) {
    this.ensurePending("REPORT_MELDS");
    this.clearValidation();

    const meldOffer = this.state.humanMeldOffer;
    if (!meldOffer || meldOffer.totalPoints === 0) {
      this.reject("There are no melds to report.");
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
      meldDeclarations: this.visibleMeldSets()
        .map((meldSet) => this.toMeldDeclarationView(meldSet))
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

        const choice = this.chooseTrumpForAi(player, this.state.trumpTurnOffset === 3);
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

      const chosenIndex = this.chooseCardForAi(player, legal);
      this.playCardInternal(chosenIndex, this.belaEligibleCardIndices(player).includes(chosenIndex));
    }
  }

  private playCardInternal(handIndex: number, callBela: boolean) {
    const player = this.currentPlayer();
    const belaEligible = this.isBelaEligible(player, handIndex);
    if (callBela && !belaEligible) {
      this.reject("Bela cannot be called with that card.");
    }

    const [card] = player.hand.splice(handIndex, 1);
    if (!card) {
      this.reject("That card is not legal in the current trick.");
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
        teamOnePoints: String(teamOnePoints),
        teamTwoPoints: String(teamTwoPoints)
      });
    } else {
      defenders.gameScore += totalPoints;
      this.log("SCORE", `${declarer.name} failed the hand. ${defenders.name} collected all ${totalPoints} points.`, {
        winner: defenders.name,
        points: String(totalPoints)
      });
    }

    const winner = this.state.teamOne.gameScore >= this.state.teamTwo.gameScore ? this.state.teamOne : this.state.teamTwo;
    if (winner.gameScore >= this.state.gameTargetPoints) {
      winner.matchWins += 1;
      this.log("INFO", `${winner.name} won the game.`, {
        eventKind: "GAME_WIN",
        winner: winner.name,
        winningScore: String(winner.gameScore),
        matchWins: String(winner.matchWins)
      });

      if (winner.matchWins >= this.state.matchTargetWins) {
        this.state.phase = "MATCH_COMPLETE";
        this.state.pendingType = "NONE";
        this.log("INFO", `${winner.name} won the match.`, {
          eventKind: "MATCH_WIN",
          winner: winner.name,
          matchWins: String(winner.matchWins)
        });
        return;
      }

      this.state.phase = "BETWEEN_GAMES";
      this.state.pendingType = "START_NEXT_GAME";
      this.state.pendingValidationMessage = null;
      this.state.currentTrick = null;
      return;
    }

    this.startNextGame(true);
  }

  private startNextFullGame(rotateDealer: boolean) {
    this.state.teamOne.gameScore = 0;
    this.state.teamTwo.gameScore = 0;
    this.state.gameNumber += 1;
    this.startNextHand(rotateDealer);
    this.log("INFO", `Game ${this.state.gameNumber} started. ${this.playerAt(this.state.dealerIndex).name} is the dealer.`, {
      eventKind: "GAME_START",
      gameNumber: String(this.state.gameNumber),
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

    this.state.phase = "TRUMP_SELECTION";
    this.state.pendingType = "NONE";
    this.state.pendingValidationMessage = null;
    this.state.trumpSuit = null;
    this.state.declarer = null;
    this.state.trumpTurnOffset = 0;
    this.state.currentPlayerIndex = (this.state.dealerIndex + 1) % this.state.players.length;
    this.state.teamOne.trickPoints = 0;
    this.state.teamOne.meldPoints = 0;
    this.state.teamTwo.trickPoints = 0;
    this.state.teamTwo.meldPoints = 0;
    this.state.currentTrick = null;
    this.state.lastWinningMeldSets = [];
    this.state.declaredMeldSets = [];
    this.state.humanMeldOffer = null;
    this.state.pendingMeldWinner = null;
    this.state.firstTrickAnnounced = false;
    this.state.declarerPlayerIndex = null;

    for (const player of this.state.players) {
      player.hand = [];
      player.belaCalled = false;
      player.belaResolved = false;
    }

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

  private applyMelds() {
    if (!this.state.trumpSuit) {
      return;
    }

    this.state.declaredMeldSets = this.state.players
      .map((player) => evaluateMeldSet(player, this.state.trumpSuit!))
      .filter((meldSet) => meldSet.totalPoints > 0);
    this.state.humanMeldOffer = null;
    this.finalizeMeldDeclarations();
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

  private chooseCardForAi(player: PlayerState, legalIndices: number[]) {
    switch (this.state.difficulty) {
      case "EASY":
        return legalIndices[this.random.nextInt(legalIndices.length)];
      case "HARD":
        return this.chooseHardCard(player, legalIndices);
      case "NORMAL":
      default:
        return this.chooseNormalCard(player, legalIndices);
    }
  }

  private chooseNormalCard(player: PlayerState, legalIndices: number[]) {
    const currentWinner = findWinningPlay(this.state.currentTrick?.cards ?? [], this.state.trumpSuit);
    const currentLeadSuit = leadSuit(this.state.currentTrick?.cards ?? []);
    return [...legalIndices].sort((leftIndex, rightIndex) => {
      const leftCard = player.hand[leftIndex];
      const rightCard = player.hand[rightIndex];
      const leftWins = !currentWinner || cardWins(leftCard, currentWinner.card, currentLeadSuit, this.state.trumpSuit);
      const rightWins = !currentWinner || cardWins(rightCard, currentWinner.card, currentLeadSuit, this.state.trumpSuit);
      const leftScore = leftWins ? cardPoints(leftCard, this.state.trumpSuit) : 100 + cardPoints(leftCard, this.state.trumpSuit);
      const rightScore = rightWins ? cardPoints(rightCard, this.state.trumpSuit) : 100 + cardPoints(rightCard, this.state.trumpSuit);
      return leftScore - rightScore;
    })[0];
  }

  private chooseHardCard(player: PlayerState, legalIndices: number[]) {
    const currentWinner = findWinningPlay(this.state.currentTrick?.cards ?? [], this.state.trumpSuit);
    const currentLeadSuit = leadSuit(this.state.currentTrick?.cards ?? []);
    const winningCards = legalIndices.filter(
      (index) => !currentWinner || cardWins(player.hand[index], currentWinner.card, currentLeadSuit, this.state.trumpSuit)
    );

    if (winningCards.length > 0) {
      return [...winningCards].sort(
        (leftIndex, rightIndex) =>
          cardStrength(player.hand[leftIndex], currentLeadSuit, this.state.trumpSuit) -
          cardStrength(player.hand[rightIndex], currentLeadSuit, this.state.trumpSuit)
      )[0];
    }

    return [...legalIndices].sort(
      (leftIndex, rightIndex) =>
        cardPoints(player.hand[leftIndex], this.state.trumpSuit) - cardPoints(player.hand[rightIndex], this.state.trumpSuit)
    )[0];
  }

  private chooseTrumpForAi(player: PlayerState, forced: boolean): TrumpChoice {
    let bestChoice: TrumpChoice = "SKIP";
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const suit of SUITS) {
      const score = player.hand.reduce((sum, card) => sum + trumpSelectionScore(card, suit), 0);
      if (score > bestScore) {
        bestScore = score;
        bestChoice = suit;
      }
    }

    const threshold = this.state.difficulty === "EASY" ? 42 : this.state.difficulty === "HARD" ? 32 : 36;
    return forced || bestScore >= threshold ? bestChoice : "SKIP";
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
    const winner = this.determineWinningMeldWinner(this.state.declaredMeldSets);
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

  private determineWinningMeldWinner(declaredMeldSets: MeldSet[]) {
    const yourSets = declaredMeldSets.filter((meldSet) => meldSet.player.team.side === "YOURS");
    const enemySets = declaredMeldSets.filter((meldSet) => meldSet.player.team.side === "ENEMIES");
    const yourHighest = Math.max(0, ...yourSets.map((meldSet) => meldSet.strongestComparisonValue));
    const enemyHighest = Math.max(0, ...enemySets.map((meldSet) => meldSet.strongestComparisonValue));

    if (yourHighest === 0 && enemyHighest === 0) {
      return null;
    }

    const winningTeam = yourHighest > enemyHighest ? "YOURS" : enemyHighest > yourHighest ? "ENEMIES" : this.state.declarer;
    if (!winningTeam) {
      return null;
    }

    const players = winningTeam === "YOURS" ? yourSets : enemySets;
    return {
      team: winningTeam,
      teamName: this.teamFor(winningTeam).name,
      players,
      totalPoints: players.reduce((sum, player) => sum + player.totalPoints, 0)
    } satisfies MeldWinner;
  }

  private teamHandPoints(team: TeamState) {
    return team.trickPoints === 0 ? 0 : team.trickPoints + team.meldPoints;
  }

  private belaEligibleCardIndices(player: PlayerState) {
    return indexRange(player.hand.length).filter((index) => this.isBelaEligible(player, index));
  }

  private isBelaEligible(player: PlayerState, handIndex: number) {
    if (player.belaResolved || !this.state.trumpSuit || handIndex < 0 || handIndex >= player.hand.length) {
      return false;
    }

    const card = player.hand[handIndex];
    if (card.suit !== this.state.trumpSuit || (card.rank !== "QUEEN" && card.rank !== "KING")) {
      return false;
    }

    const partnerRank: Rank = card.rank === "QUEEN" ? "KING" : "QUEEN";
    return player.hand.some((candidate, index) => index !== handIndex && candidate.suit === this.state.trumpSuit && candidate.rank === partnerRank);
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
          prompt: "Review the melds and continue."
        };
      case "PLAY_CARD":
        return {
          type: "PLAY_CARD",
          actingPlayerId: this.currentPlayer().id,
          legalCardIndices: legalCardIndices(this.currentPlayer(), this.state.currentTrick?.cards ?? [], this.state.trumpSuit),
          legalTrumpChoices: [],
          belaEligibleCardIndices: this.belaEligibleCardIndices(this.currentPlayer()),
          availableMelds: [],
          meldWinner: null,
          validationMessage: this.state.pendingValidationMessage,
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

  private toMeldDeclarationView(meldSet: MeldSet): MeldDeclarationView {
    return {
      playerId: meldSet.player.id,
      playerName: meldSet.player.name,
      teamName: meldSet.player.team.name,
      meldPoints: meldSet.totalPoints,
      belaPoints: 0,
      labels: meldSet.melds.map((meld) => meld.label)
    };
  }

  private visibleMeldSets() {
    return this.state.lastWinningMeldSets;
  }

  private advanceTrumpTurn() {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    this.state.trumpTurnOffset += 1;
    this.state.pendingType = "NONE";
  }

  private ensurePending(expected: ActionType) {
    this.ensure(this.state.pendingType === expected, "That action is not expected right now.");
  }

  private ensure(condition: boolean, message: string) {
    if (!condition) {
      this.reject(message);
    }
  }

  private reject(message: string): never {
    this.state.pendingValidationMessage = message;
    this.log("ERROR", message, {});
    throw new Error(message);
  }

  private clearValidation() {
    this.state.pendingValidationMessage = null;
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
    meldPoints: 0
  };
  const enemyTeam: TeamState = {
    side: "ENEMIES",
    name: "Them",
    matchWins: 0,
    gameScore: 0,
    trickPoints: 0,
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
    pendingValidationMessage: null
  };
}

function sanitizeMatchTargetWins(matchTargetWins: number): MatchTargetWins {
  return matchTargetWins === 1 || matchTargetWins === 3 || matchTargetWins === 5 ? matchTargetWins : DEFAULT_MATCH_TARGET_WINS;
}

function createShuffledDeck(random: RandomSource) {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(index + 1);
    const current = deck[index];
    deck[index] = deck[swapIndex];
    deck[swapIndex] = current;
  }

  return deck;
}

function compareCards(left: Card, right: Card) {
  const suitCompare = SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit);
  if (suitCompare !== 0) {
    return suitCompare;
  }
  return RANKS.indexOf(left.rank) - RANKS.indexOf(right.rank);
}

function cardLabel(card: Card) {
  return `${rankSymbols[card.rank]}${suitSymbols[card.suit]}`;
}

function cardPoints(card: Card, trumpSuit: Suit | null) {
  const trump = card.suit === trumpSuit;
  switch (card.rank) {
    case "SEVEN":
    case "EIGHT":
      return 0;
    case "NINE":
      return trump ? 14 : 0;
    case "JACK":
      return trump ? 20 : 2;
    case "QUEEN":
      return 3;
    case "KING":
      return 4;
    case "TEN":
      return 10;
    case "ACE":
      return 11;
  }
}

function cardStrength(card: Card, leadSuitValue: Suit | null, trumpSuit: Suit | null) {
  if (card.suit === trumpSuit) {
    switch (card.rank) {
      case "JACK":
        return 80;
      case "NINE":
        return 70;
      case "ACE":
        return 60;
      case "TEN":
        return 50;
      case "KING":
        return 40;
      case "QUEEN":
        return 30;
      case "EIGHT":
        return 20;
      case "SEVEN":
        return 10;
    }
  }

  if (card.suit === leadSuitValue) {
    switch (card.rank) {
      case "ACE":
        return 60;
      case "TEN":
        return 50;
      case "KING":
        return 40;
      case "QUEEN":
        return 30;
      case "JACK":
        return 20;
      case "NINE":
        return 15;
      case "EIGHT":
        return 10;
      case "SEVEN":
        return 5;
    }
  }

  return 0;
}

function trumpSelectionScore(card: Card, candidateTrump: Suit) {
  const base = cardPoints(card, candidateTrump) + cardStrength(card, candidateTrump, candidateTrump);
  if (card.suit === candidateTrump && card.rank === "JACK") {
    return base + 30;
  }
  if (card.suit === candidateTrump && card.rank === "NINE") {
    return base + 20;
  }
  if (card.suit !== candidateTrump && card.rank === "ACE") {
    return base + 8;
  }
  return base;
}

function leadSuit(trick: PlayedCard[]) {
  return trick.length === 0 ? null : trick[0].card.suit;
}

function legalCardIndices(player: PlayerState, trick: PlayedCard[], trumpSuit: Suit | null) {
  if (trick.length === 0) {
    return indexRange(player.hand.length);
  }

  const currentLeadSuit = trick[0].card.suit;
  const leadSuitCards = indexesForSuit(player.hand, currentLeadSuit);
  if (leadSuitCards.length > 0) {
    if (currentLeadSuit === trumpSuit) {
      const overTrump = higherTrumpCards(player.hand, trick, trumpSuit);
      return overTrump.length === 0 ? leadSuitCards : overTrump;
    }
    return leadSuitCards;
  }

  const currentWinner = findWinningPlay(trick, trumpSuit);
  const partnerWinning = currentWinner != null && player.team.side === teamSideForPlayer(currentWinner.playerIndex);
  const trumpCards = indexesForSuit(player.hand, trumpSuit);
  if (partnerWinning || trumpCards.length === 0) {
    return indexRange(player.hand.length);
  }

  const overTrump = higherTrumpCards(player.hand, trick, trumpSuit);
  return overTrump.length === 0 ? trumpCards : overTrump;
}

function findWinningPlay(trick: PlayedCard[], trumpSuit: Suit | null) {
  if (trick.length === 0) {
    return null;
  }

  const currentLeadSuit = leadSuit(trick);
  return trick.reduce((winner, play) =>
    cardStrength(play.card, currentLeadSuit, trumpSuit) > cardStrength(winner.card, currentLeadSuit, trumpSuit) ? play : winner
  );
}

function cardWins(challenger: Card, currentWinner: Card, currentLeadSuit: Suit | null, trumpSuit: Suit | null) {
  return cardStrength(challenger, currentLeadSuit, trumpSuit) > cardStrength(currentWinner, currentLeadSuit, trumpSuit);
}

function higherTrumpCards(hand: Card[], trick: PlayedCard[], trumpSuit: Suit | null) {
  if (!trumpSuit) {
    return [];
  }

  const currentWinner = findWinningPlay(trick, trumpSuit);
  if (!currentWinner || currentWinner.card.suit !== trumpSuit) {
    return indexesForSuit(hand, trumpSuit);
  }

  return indexRange(hand.length)
    .filter((index) => hand[index].suit === trumpSuit)
    .filter((index) => cardStrength(hand[index], trumpSuit, trumpSuit) > cardStrength(currentWinner.card, trumpSuit, trumpSuit));
}

function indexesForSuit(hand: Card[], suit: Suit | null) {
  if (!suit) {
    return [];
  }

  const indexes: number[] = [];
  for (let index = 0; index < hand.length; index += 1) {
    if (hand[index].suit === suit) {
      indexes.push(index);
    }
  }
  return indexes;
}

function indexRange(size: number) {
  return Array.from({ length: size }, (_, index) => index);
}

function teamSideForPlayer(playerIndex: number): TeamSide {
  return playerIndex % 2 === 0 ? "YOURS" : "ENEMIES";
}

function evaluateMeldSet(player: PlayerState, trumpSuit: Suit): MeldSet {
  const candidates = [...sameRankCandidates(player.hand), ...sequenceCandidates(player.hand)];
  const best = chooseBestNonOverlapping(candidates, 0, new Set<string>(), [], 0, 0, null);
  return {
    player,
    melds: best?.melds ?? [],
    totalPoints: best?.totalPoints ?? 0,
    strongestComparisonValue: best?.strongestComparisonValue ?? 0
  };
}

function groupCardsByRank(cards: Card[]) {
  const byRank = new Map<Rank, Card[]>();
  for (const card of cards) {
    const matchingCards = byRank.get(card.rank) ?? [];
    matchingCards.push(card);
    byRank.set(card.rank, matchingCards);
  }
  return byRank;
}

function groupCardsBySuit(cards: Card[]) {
  const bySuit = new Map<Suit, Card[]>();
  for (const card of cards) {
    const suitedCards = bySuit.get(card.suit) ?? [];
    suitedCards.push(card);
    bySuit.set(card.suit, suitedCards);
  }
  return bySuit;
}

function sameRankCandidates(cards: Card[]): MeldCombination[] {
  const combinations: MeldCombination[] = [];
  const byRank = groupCardsByRank(cards);

  for (const [rank, matchingCards] of byRank.entries()) {
    if (matchingCards.length !== 4 || rank === "SEVEN" || rank === "EIGHT") {
      continue;
    }

    if (rank === "JACK") {
      combinations.push({
        kind: "FOUR_OF_A_KIND",
        label: "Four Jacks",
        points: 200,
        comparisonValue: 700 + RANKS.indexOf(rank),
        cards: [...matchingCards]
      });
      continue;
    }

    if (rank === "NINE") {
      combinations.push({
        kind: "FOUR_OF_A_KIND",
        label: "Four Nines",
        points: 150,
        comparisonValue: 650 + RANKS.indexOf(rank),
        cards: [...matchingCards]
      });
      continue;
    }

    combinations.push({
      kind: "FOUR_OF_A_KIND",
      label: "Four of a Kind",
      points: 100,
      comparisonValue: 600 + RANKS.indexOf(rank),
      cards: [...matchingCards]
    });
  }

  return combinations;
}

function sequenceCandidates(cards: Card[]): MeldCombination[] {
  const combinations: MeldCombination[] = [];
  const bySuit = groupCardsBySuit(cards);

  for (const suitedCards of bySuit.values()) {
    const sortedCards = [...suitedCards].sort((left, right) => RANKS.indexOf(left.rank) - RANKS.indexOf(right.rank));
    for (let start = 0; start < sortedCards.length; start += 1) {
      const run: Card[] = [sortedCards[start]];
      for (let index = start + 1; index < sortedCards.length; index += 1) {
        if (RANKS.indexOf(sortedCards[index].rank) !== RANKS.indexOf(sortedCards[index - 1].rank) + 1) {
          break;
        }
        run.push(sortedCards[index]);
        if (run.length >= 3) {
          combinations.push(toSequenceCombination(run));
        }
      }
    }
  }

  return combinations;
}

function toSequenceCombination(run: Card[]): MeldCombination {
  const highest = run[run.length - 1];
  if (run.length >= 5) {
    return {
      kind: "SEQUENCE",
      label: `Sequence of ${run.length}`,
      points: 100,
      comparisonValue: 500 + RANKS.indexOf(highest.rank),
      cards: [...run]
    };
  }

  if (run.length === 4) {
    return {
      kind: "SEQUENCE",
      label: "Sequence of 4",
      points: 50,
      comparisonValue: 450 + RANKS.indexOf(highest.rank),
      cards: [...run]
    };
  }

  return {
    kind: "SEQUENCE",
    label: "Sequence of 3",
    points: 20,
    comparisonValue: 400 + RANKS.indexOf(highest.rank),
    cards: [...run]
  };
}

interface BestSelection {
  melds: MeldCombination[];
  totalPoints: number;
  strongestComparisonValue: number;
}

function chooseBestNonOverlapping(
  candidates: MeldCombination[],
  index: number,
  usedCards: Set<string>,
  chosen: MeldCombination[],
  totalPoints: number,
  strongestComparisonValue: number,
  best: BestSelection | null
): BestSelection | null {
  let currentBest = best;
  if (index >= candidates.length) {
    const candidate: BestSelection = {
      melds: [...chosen],
      totalPoints,
      strongestComparisonValue
    };
    return !currentBest || beatsSelection(candidate, currentBest) ? candidate : currentBest;
  }

  currentBest = chooseBestNonOverlapping(candidates, index + 1, usedCards, chosen, totalPoints, strongestComparisonValue, currentBest);
  const combination = candidates[index];
  const combinationKeys = combination.cards.map(cardKey);
  if (combinationKeys.every((key) => !usedCards.has(key))) {
    combinationKeys.forEach((key) => usedCards.add(key));
    chosen.push(combination);
    currentBest = chooseBestNonOverlapping(
      candidates,
      index + 1,
      usedCards,
      chosen,
      totalPoints + combination.points,
      Math.max(strongestComparisonValue, combination.comparisonValue),
      currentBest
    );
    chosen.pop();
    combinationKeys.forEach((key) => usedCards.delete(key));
  }

  return currentBest;
}

function beatsSelection(candidate: BestSelection, best: BestSelection) {
  if (candidate.totalPoints !== best.totalPoints) {
    return candidate.totalPoints > best.totalPoints;
  }
  if (candidate.strongestComparisonValue !== best.strongestComparisonValue) {
    return candidate.strongestComparisonValue > best.strongestComparisonValue;
  }
  return candidate.melds.length < best.melds.length;
}

function cardKey(card: Card) {
  return `${card.suit}:${card.rank}`;
}
