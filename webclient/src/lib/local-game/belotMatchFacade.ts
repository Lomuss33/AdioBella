import type {
  Difficulty,
  GameLength,
  GameEvent,
  GameSnapshot,
  MeldDeclarationView,
  MatchTargetWins,
  PendingAction,
  PlayedCardView,
  PlayerView,
  ScoreView
} from "../../types";
import type { RandomSource } from "./random";
import { BrowserRandom } from "./random";

type ActionType = "NONE" | "START_MATCH" | "START_NEXT_GAME" | "CHOOSE_TRUMP" | "PLAY_CARD";
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
}

interface TrickState {
  leadPlayerIndex: number;
  cards: PlayedCard[];
}

interface MeldAward {
  player: PlayerState;
  meldPoints: number;
  belaPoints: number;
  comparisonValue: number;
  labels: string[];
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
  lastMeldAwards: MeldAward[];
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
    this.ensurePending("PLAY_CARD");
    this.clearValidation();

    const legal = legalCardIndices(this.currentPlayer(), this.state.currentTrick?.cards ?? [], this.state.trumpSuit);
    if (!legal.includes(handIndex)) {
      this.reject("That card is not legal in the current trick.");
    }

    this.playCardInternal(handIndex);
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
      meldDeclarations: this.state.lastMeldAwards
        .filter((award) => award.meldPoints > 0 || award.belaPoints > 0)
        .map((award) => this.toMeldDeclarationView(award))
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

      const player = this.currentPlayer();
      const legal = legalCardIndices(player, this.state.currentTrick?.cards ?? [], this.state.trumpSuit);
      if (player.human) {
        this.state.pendingType = "PLAY_CARD";
        return;
      }

      const chosenIndex = this.chooseCardForAi(player, legal);
      this.playCardInternal(chosenIndex);
    }
  }

  private playCardInternal(handIndex: number) {
    const player = this.currentPlayer();
    const [card] = player.hand.splice(handIndex, 1);
    if (!card) {
      this.reject("That card is not legal in the current trick.");
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
    const teamOnePoints = this.state.teamOne.trickPoints + this.state.teamOne.meldPoints;
    const teamTwoPoints = this.state.teamTwo.trickPoints + this.state.teamTwo.meldPoints;
    const declarer = this.state.declarer ? this.teamFor(this.state.declarer) : null;
    const defenders = this.state.declarer ? this.otherTeam(this.state.declarer) : null;
    const totalPoints = teamOnePoints + teamTwoPoints;

    if (!declarer || !defenders) {
      throw new Error("Cannot finish game without declarer.");
    }

    if (declarer.trickPoints + declarer.meldPoints > defenders.trickPoints + defenders.meldPoints) {
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
    this.state.lastMeldAwards = [];
    this.state.declarerPlayerIndex = null;

    for (const player of this.state.players) {
      player.hand = [];
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
    this.applyMelds();
    this.log("INFO", `${this.playerAt(this.state.currentPlayerIndex).name} leads the first trick.`, {
      playerId: this.playerAt(this.state.currentPlayerIndex).id
    });
  }

  private applyMelds() {
    if (!this.state.trumpSuit) {
      return;
    }

    const awards = this.state.players.map((player) => evaluateMeld(player, this.state.trumpSuit!));
    this.state.lastMeldAwards = awards;

    const winningTeam = this.determineWinningMeldTeam(awards);
    if (!winningTeam) {
      return;
    }

    const points = awards
      .filter((award) => award.player.team.side === winningTeam)
      .reduce((sum, award) => sum + award.meldPoints + award.belaPoints, 0);

    if (points === 0) {
      return;
    }

    this.teamFor(winningTeam).meldPoints += points;
    const labels = awards
      .filter((award) => award.player.team.side === winningTeam)
      .flatMap((award) => declarationLabels(award))
      .join(", ");

    this.log("INFO", `${this.teamFor(winningTeam).name} won meld points: ${labels || `${points} points`}.`, {
      team: this.teamFor(winningTeam).name,
      points: String(points)
    });
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

  private buildPendingAction(): PendingAction {
    switch (this.state.pendingType) {
      case "START_MATCH":
        return {
          type: "START_MATCH",
          actingPlayerId: this.playerAt(0).id,
          legalCardIndices: [],
          legalTrumpChoices: [],
          validationMessage: this.state.pendingValidationMessage,
          prompt: "Start the match."
        };
      case "START_NEXT_GAME":
        return {
          type: "START_NEXT_GAME",
          actingPlayerId: this.playerAt(0).id,
          legalCardIndices: [],
          legalTrumpChoices: [],
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
          validationMessage: this.state.pendingValidationMessage,
          prompt: this.state.trumpTurnOffset === 3 ? "Choose the trump suit." : "Choose the trump suit or skip."
        };
      case "PLAY_CARD":
        return {
          type: "PLAY_CARD",
          actingPlayerId: this.currentPlayer().id,
          legalCardIndices: legalCardIndices(this.currentPlayer(), this.state.currentTrick?.cards ?? [], this.state.trumpSuit),
          legalTrumpChoices: [],
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

  private toMeldDeclarationView(award: MeldAward): MeldDeclarationView {
    return {
      playerId: award.player.id,
      playerName: award.player.name,
      teamName: award.player.team.name,
      meldPoints: award.meldPoints,
      belaPoints: award.belaPoints,
      labels: [...award.labels]
    };
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
    return team.gameScore + team.trickPoints + team.meldPoints;
  }

  private determineWinningMeldTeam(awards: MeldAward[]) {
    const yourHighest = highestComparisonValue(awards, "YOURS");
    const enemyHighest = highestComparisonValue(awards, "ENEMIES");

    if (yourHighest > enemyHighest) {
      return "YOURS" as const;
    }
    if (enemyHighest > yourHighest) {
      return "ENEMIES" as const;
    }

    if (yourHighest > 0) {
      return this.state.declarer;
    }

    const yourTotal = declarationPointsForTeam(awards, "YOURS");
    const enemyTotal = declarationPointsForTeam(awards, "ENEMIES");
    if (yourTotal === 0 && enemyTotal === 0) {
      return null;
    }
    if (yourTotal > enemyTotal) {
      return "YOURS" as const;
    }
    if (enemyTotal > yourTotal) {
      return "ENEMIES" as const;
    }
    return this.state.declarer;
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
    lastMeldAwards: [],
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

function highestComparisonValue(awards: MeldAward[], side: TeamSide) {
  return awards
    .filter((award) => award.player.team.side === side)
    .reduce((highest, award) => Math.max(highest, award.comparisonValue), 0);
}

function declarationPointsForTeam(awards: MeldAward[], side: TeamSide) {
  return awards
    .filter((award) => award.player.team.side === side)
    .reduce((total, award) => total + award.meldPoints + award.belaPoints, 0);
}

function declarationLabels(award: MeldAward) {
  return award.belaPoints > 0 ? [...award.labels, "Bela"] : [...award.labels];
}

function evaluateMeld(player: PlayerState, trumpSuit: Suit): MeldAward {
  const labels: string[] = [];
  let meldPoints = 0;
  const belaPoints = hasBela(player.hand, trumpSuit) ? 20 : 0;
  let comparisonValue = 0;

  const byRank = new Map<Rank, Card[]>();
  for (const card of player.hand) {
    const cards = byRank.get(card.rank) ?? [];
    cards.push(card);
    byRank.set(card.rank, cards);
  }

  for (const [rank, cards] of byRank.entries()) {
    if (cards.length !== 4 || rank === "SEVEN" || rank === "EIGHT") {
      continue;
    }

    if (rank === "JACK") {
      meldPoints += 200;
      comparisonValue = Math.max(comparisonValue, 700);
      labels.push("Four Jacks");
    } else if (rank === "NINE") {
      meldPoints += 150;
      comparisonValue = Math.max(comparisonValue, 650);
      labels.push("Four Nines");
    } else {
      meldPoints += 100;
      comparisonValue = Math.max(comparisonValue, 600);
      labels.push("Four of a Kind");
    }
  }

  const bySuit = new Map<Suit, Card[]>();
  for (const card of player.hand) {
    const cards = bySuit.get(card.suit) ?? [];
    cards.push(card);
    bySuit.set(card.suit, cards);
  }

  for (const cards of bySuit.values()) {
    const sortedCards = [...cards].sort((left, right) => RANKS.indexOf(left.rank) - RANKS.indexOf(right.rank));
    let runLength = 1;
    for (let index = 1; index <= sortedCards.length; index += 1) {
      const contiguous =
        index < sortedCards.length && RANKS.indexOf(sortedCards[index].rank) === RANKS.indexOf(sortedCards[index - 1].rank) + 1;

      if (contiguous) {
        runLength += 1;
        continue;
      }

      if (runLength >= 3) {
        if (runLength >= 5) {
          meldPoints += 100;
          comparisonValue = Math.max(comparisonValue, 500 + runLength);
          labels.push(`Sequence of ${runLength}`);
        } else if (runLength === 4) {
          meldPoints += 50;
          comparisonValue = Math.max(comparisonValue, 450);
          labels.push("Sequence of 4");
        } else {
          meldPoints += 20;
          comparisonValue = Math.max(comparisonValue, 400);
          labels.push("Sequence of 3");
        }
      }

      runLength = 1;
    }
  }

  return {
    player,
    meldPoints,
    belaPoints,
    comparisonValue,
    labels
  };
}

function hasBela(cards: Card[], trumpSuit: Suit) {
  const hasKing = cards.some((card) => card.suit === trumpSuit && card.rank === "KING");
  const hasQueen = cards.some((card) => card.suit === trumpSuit && card.rank === "QUEEN");
  return hasKing && hasQueen;
}
