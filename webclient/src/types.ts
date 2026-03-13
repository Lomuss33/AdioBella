export type ActionType = "NONE" | "START_MATCH" | "START_NEXT_GAME" | "CHOOSE_TRUMP" | "REPORT_MELDS" | "ACKNOWLEDGE_MELDS" | "PLAY_CARD";
export type Seat = "SOUTH" | "WEST" | "NORTH" | "EAST";
export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type GameLength = "SHORT" | "LONG";
export type MatchTargetWins = 1 | 3 | 5;
export type TableTheme = "GREEN" | "DARK_BLUE" | "CHERRY_RED" | "WOODY_BROWN" | "FINE_BLACK";

export interface CardView {
  suit: string | null;
  rank: string | null;
  label: string;
  faceUp: boolean;
  playable: boolean;
}

export interface PlayerView {
  id: string;
  name: string;
  seat: Seat;
  human: boolean;
  team: string;
  hand: CardView[];
  handSize: number;
  matchScore: number;
  gamePoints: number;
  dealer: boolean;
  currentTurn: boolean;
}

export interface PlayedCardView {
  playerId: string;
  playerName: string;
  seat: Seat;
  card: CardView;
}

export interface TrickView {
  leadPlayerId: string | null;
  cards: PlayedCardView[];
}

export interface ScoreView {
  teamOneName: string;
  teamOneMatchScore: number;
  teamOneGamePoints: number;
  teamTwoName: string;
  teamTwoMatchScore: number;
  teamTwoGamePoints: number;
  declarerTeam: string | null;
  gameNumber: number;
  difficulty: string;
  matchTargetWins: number;
  gameTargetPoints: number;
  teamOneMeldPoints: number;
  teamTwoMeldPoints: number;
  meldDeclarations: MeldDeclarationView[];
}

export interface MeldDeclarationView {
  playerId: string;
  playerName: string;
  teamName: string;
  meldPoints: number;
  belaPoints: number;
  labels: string[];
}

export interface MeldCombinationView {
  kind: string;
  label: string;
  points: number;
  comparisonValue: number;
  cards: CardView[];
}

export interface MeldSetView {
  playerId: string;
  playerName: string;
  teamName: string;
  totalPoints: number;
  melds: MeldCombinationView[];
}

export interface MeldWinnerView {
  teamName: string;
  players: MeldSetView[];
}

export interface PendingAction {
  type: ActionType;
  actingPlayerId: string | null;
  legalCardIndices: number[];
  legalTrumpChoices: string[];
  belaEligibleCardIndices: number[];
  availableMelds: MeldSetView[];
  meldWinner: MeldWinnerView | null;
  validationMessage: string | null;
  prompt: string;
}

export interface GameEvent {
  sequence: number;
  type: string;
  message: string;
  createdAt: string;
  payload: Record<string, string>;
}

export interface GameSnapshot {
  phase: string;
  trumpSuit: string | null;
  dealerPlayerId: string;
  declarerPlayerId: string | null;
  currentPlayerId: string | null;
  players: PlayerView[];
  trick: TrickView;
  score: ScoreView;
  pendingAction: PendingAction;
  lastEventSequence: number;
  matchComplete: boolean;
}

export interface SessionResponse {
  sessionId: string;
  snapshot: GameSnapshot;
}

export interface GameCompleteSummary {
  gameNumber: number;
  winnerName: string;
  loserName: string;
  winnerGamePoints: number;
  loserGamePoints: number;
  winnerMatchWins: number;
  loserMatchWins: number;
  matchTargetWins: number;
  nextGameTargetPoints: number;
  byForfeit: boolean;
}

export interface MatchCompleteSummary {
  winnerName: string;
  loserName: string;
  winnerMatchWins: number;
  loserMatchWins: number;
  matchTargetWins: number;
  finalGameWinnerPoints: number;
  finalGameLoserPoints: number;
  finalGameByForfeit: boolean;
  gameNumber: number;
}

export interface PlayerNameDrafts {
  SOUTH: string;
  WEST: string;
  NORTH: string;
  EAST: string;
}

export interface TeamNameDrafts {
  yourTeam: string;
  enemyTeam: string;
}

export interface GameSettingsDrafts {
  difficulty: Difficulty;
  matchTargetWins: MatchTargetWins;
  gameLength: GameLength;
  tableTheme: TableTheme;
}

export interface AnimatedPlayStep {
  seat: Seat;
  playerId: string;
  playerName: string;
  card: CardView;
  startAtMs: number;
  durationMs: number;
  landingPoints: number;
  pointsAfterLanding: number;
}

export interface TrickResolutionStep {
  winnerSeat: Seat;
  winnerPlayerId: string;
  trickPoints: number;
  countUpStartMs: number;
  highlightDurationMs: number;
  collectStartMs: number;
  collectDurationMs: number;
  lastTrickBonus: number;
}

export interface AnimatedTrickState {
  baseCards: PlayedCardView[];
  plays: AnimatedPlayStep[];
  visiblePlayCount: number;
  enteringPlayIndex: number | null;
  phase: "placing" | "highlight" | "collecting";
  winnerSeat: Seat | null;
  winnerPlayerId: string | null;
  winningCardKey: string | null;
  pointsDisplay: number;
  pointsVisible: boolean;
  pointsPulse: boolean;
  resolution: TrickResolutionStep | null;
}

export interface DisplaySnapshotState {
  snapshot: GameSnapshot | null;
  animatedTrick: AnimatedTrickState | null;
}
