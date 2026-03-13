import type { ReactNode } from "react";
import type {
  CardView,
  GameCompleteSummary,
  GameSettingsDrafts,
  MatchCompleteSummary,
  MeldSetView,
  MeldWinnerView,
  PendingAction,
  PlayerNameDrafts,
  TeamNameDrafts
} from "../types";
import PlayingCard from "./PlayingCard";
import SuitChoiceButton from "./SuitChoiceButton";

interface ActionPanelProps {
  pendingAction?: PendingAction;
  startScreenPhase: "boot-loading" | "ready";
  errorMessage: string | null;
  playerNames: PlayerNameDrafts;
  teamNames: TeamNameDrafts;
  gameSettings: GameSettingsDrafts;
  gameCompleteSummary: GameCompleteSummary | null;
  matchCompleteSummary: MatchCompleteSummary | null;
  onPlayerNameChange: (seat: keyof PlayerNameDrafts, value: string) => void;
  onTeamNameChange: (team: keyof TeamNameDrafts, value: string) => void;
  onGameSettingsChange: (patch: Partial<GameSettingsDrafts>) => void;
  onStart: () => void;
  onStartRematch: () => void;
  onOpenSettingsMenu: () => void;
  onChooseTrump: (choice: string) => void;
  onReportMelds: (declare: boolean) => void;
  onAcknowledgeMelds: () => void;
  pendingBelaChoiceCard: CardView | null;
  onPlayWithBela: () => void;
  onPlayWithoutBela: () => void;
}

function ActionPanel({
  pendingAction,
  startScreenPhase,
  errorMessage,
  playerNames,
  teamNames,
  gameSettings,
  gameCompleteSummary,
  matchCompleteSummary,
  onPlayerNameChange,
  onTeamNameChange,
  onGameSettingsChange,
  onStart,
  onStartRematch,
  onOpenSettingsMenu,
  onChooseTrump,
  onReportMelds,
  onAcknowledgeMelds,
  pendingBelaChoiceCard,
  onPlayWithBela,
  onPlayWithoutBela
}: ActionPanelProps) {
  const isStart = pendingAction?.type === "START_MATCH";
  const isNextGame = pendingAction?.type === "START_NEXT_GAME";
  const isTrumpChoice = pendingAction?.type === "CHOOSE_TRUMP";
  const isReportMelds = pendingAction?.type === "REPORT_MELDS";
  const isAcknowledgeMelds = pendingAction?.type === "ACKNOWLEDGE_MELDS";
  const isBelaChoice = pendingBelaChoiceCard !== null;
  const isMatchComplete = matchCompleteSummary !== null;
  const isBootLoading = isStart && startScreenPhase === "boot-loading";
  const isPopupVisible = isStart || isNextGame || isTrumpChoice || isReportMelds || isAcknowledgeMelds || isBelaChoice || isMatchComplete;

  if (!isPopupVisible) {
    return null;
  }

  const title = isStart
    ? "Start the match"
    : isMatchComplete
      ? "Match complete"
    : isNextGame
      ? "Game complete"
      : isTrumpChoice
        ? "Choose the trump suit"
        : isReportMelds || isAcknowledgeMelds
          ? "Melds"
          : "Bela";
  const subtitle = isStart
    ? "Set the table, the pace, and the people before the first deal."
    : isMatchComplete
      ? matchCompleteSubtitle(matchCompleteSummary)
    : isNextGame
      ? gameCompleteWinnerMessage(gameCompleteSummary)
      : isTrumpChoice
        ? pendingAction?.prompt || "Choose the trump suit or skip."
        : isReportMelds
          ? "Declare your melds or keep them hidden."
          : isAcknowledgeMelds
            ? "Review the winning melds before the first trick."
            : "Call Bela with this card or play it quietly.";

  return (
    <div
      className={`action-overlay ${
        isTrumpChoice ? "action-overlay-trump" : isNextGame || isMatchComplete ? "action-overlay-next-game" : "action-overlay-start"
      }`}
    >
      <div
        className={
          isBootLoading
            ? "action-popup-loading"
            : `action-popup ${isStart ? "action-popup-start" : ""}`
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {isBootLoading ? (
          <div className="start-loading-screen" aria-label="Loading table" role="status">
            <div className="start-loading-spinner" aria-hidden="true">
              <span className="loading-card loading-card-one" />
              <span className="loading-card loading-card-two" />
              <span className="loading-card loading-card-three" />
            </div>
          </div>
        ) : (
          <>
            <div className={isStart ? "start-popup-content" : ""}>
              <div className="action-popup-header action-popup-header-start">
                <span className="action-popup-ornament" aria-hidden="true" />
                <h2 className="action-popup-title">{title}</h2>
                <p className="action-popup-subtitle">{subtitle}</p>
                <span className="action-popup-ornament" aria-hidden="true" />
                {errorMessage ? <p className="error-line">{errorMessage}</p> : null}
              </div>
              {isStart ? (
                <div className="action-popup-body">
                  <div className="team-settings-grid">
                    <TeamSettingsRow
                      heading="Us"
                      teamLabel="your team"
                      teamValue={teamNames.yourTeam}
                      onTeamChange={(value) => onTeamNameChange("yourTeam", value)}
                      firstPlayerLabel="you"
                      firstPlayerValue={playerNames.SOUTH}
                      onFirstPlayerChange={(value) => onPlayerNameChange("SOUTH", value)}
                      secondPlayerLabel="teammate"
                      secondPlayerValue={playerNames.NORTH}
                      onSecondPlayerChange={(value) => onPlayerNameChange("NORTH", value)}
                    />
                    <TeamSettingsRow
                      heading="Them"
                      teamLabel="enemy team"
                      teamValue={teamNames.enemyTeam}
                      onTeamChange={(value) => onTeamNameChange("enemyTeam", value)}
                      firstPlayerLabel="west"
                      firstPlayerValue={playerNames.WEST}
                      onFirstPlayerChange={(value) => onPlayerNameChange("WEST", value)}
                      secondPlayerLabel="east"
                      secondPlayerValue={playerNames.EAST}
                      onSecondPlayerChange={(value) => onPlayerNameChange("EAST", value)}
                    />
                  </div>

                  <div className="settings-stack">
                    <SettingGroup label="match length" boxed>
                      {([1, 3, 5] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`setting-pill ${gameSettings.matchTargetWins === value ? "selected" : ""}`}
                          onClick={() => onGameSettingsChange({ matchTargetWins: value })}
                        >
                          first to {value}
                        </button>
                      ))}
                    </SettingGroup>

                    <SettingGroup label="game length" boxed>
                      {([
                        { value: "SHORT", label: "short 501" },
                        { value: "LONG", label: "long 1001" }
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`setting-pill ${gameSettings.gameLength === option.value ? "selected" : ""}`}
                          onClick={() => onGameSettingsChange({ gameLength: option.value })}
                        >
                          {option.label}
                        </button>
                      ))}
                    </SettingGroup>

                    <SettingGroup label="table color" boxed className="setting-group-wide">
                      {([
                        { value: "GREEN", label: "green" },
                        { value: "DARK_BLUE", label: "dark blue" },
                        { value: "CHERRY_RED", label: "cherry red" },
                        { value: "WOODY_BROWN", label: "woody brown" },
                        { value: "FINE_BLACK", label: "fine black" }
                      ] as const).map((theme) => (
                        <button
                          key={theme.value}
                          type="button"
                          className={`setting-pill setting-pill-theme setting-pill-theme-${theme.value.toLowerCase()} ${gameSettings.tableTheme === theme.value ? "selected" : ""}`}
                          onClick={() => onGameSettingsChange({ tableTheme: theme.value })}
                        >
                          {theme.label}
                        </button>
                      ))}
                    </SettingGroup>
                  </div>

                  <div className="start-action-row">
                    <SettingGroup label="difficulty" className="start-difficulty-group">
                      {(["EASY", "NORMAL", "HARD"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`setting-pill setting-pill-difficulty setting-pill-difficulty-${mode.toLowerCase()} ${gameSettings.difficulty === mode ? "selected" : ""}`}
                          onClick={() => onGameSettingsChange({ difficulty: mode })}
                        >
                          {mode.toLowerCase()}
                        </button>
                      ))}
                    </SettingGroup>
                    <div className="action-controls action-controls-start">
                      <button type="button" className="action-button action-button-primary" onClick={onStart}>
                        Start the match
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {isReportMelds ? (
                <div className="action-popup-body meld-popup-body">
                  <MeldSetSection meldSet={pendingAction?.availableMelds?.[0] ?? null} />
                </div>
              ) : null}
              {isAcknowledgeMelds ? (
                <div className="action-popup-body meld-popup-body">
                  <MeldWinnerSection meldWinner={pendingAction?.meldWinner ?? null} />
                </div>
              ) : null}
              {isBelaChoice ? (
                <div className="action-popup-body meld-popup-body bela-popup-body">
                  <div className="meld-card-row meld-card-row-single">
                    <PlayingCard card={pendingBelaChoiceCard} />
                  </div>
                </div>
              ) : null}
              {isNextGame ? (
                <div className="between-games-summary">
                  {gameCompleteSummary ? <GameCompleteSummaryPanel summary={gameCompleteSummary} /> : null}
                </div>
              ) : null}
              {isMatchComplete ? (
                <div className="between-games-summary">
                  <div className="between-games-chip">match result</div>
                  {matchCompleteSummary ? <MatchCompleteSummaryPanel summary={matchCompleteSummary} /> : null}
                </div>
              ) : null}
            </div>
            <div className={`action-controls ${isTrumpChoice ? "trump-controls" : ""}`}>
              {isMatchComplete ? (
                <>
                  <button type="button" className="action-button" onClick={onOpenSettingsMenu}>
                    Settings
                  </button>
                  <button type="button" className="action-button action-button-primary" onClick={onStartRematch}>
                    Revenge
                  </button>
                </>
              ) : null}
              {isNextGame ? (
                <button type="button" className="action-button action-button-primary" onClick={onStart}>
                  Deal the next game
                </button>
              ) : null}
              {isReportMelds ? (
                <>
                  <button type="button" className="action-button" onClick={() => onReportMelds(false)}>
                    Pass
                  </button>
                  <button type="button" className="action-button action-button-primary" onClick={() => onReportMelds(true)}>
                    Declare melds
                  </button>
                </>
              ) : null}
              {isAcknowledgeMelds ? (
                <button type="button" className="action-button action-button-primary" onClick={onAcknowledgeMelds}>
                  Continue
                </button>
              ) : null}
              {isBelaChoice ? (
                <>
                  <button type="button" className="action-button" onClick={onPlayWithoutBela}>
                    Play only
                  </button>
                  <button type="button" className="action-button action-button-primary" onClick={onPlayWithBela}>
                    Play + Bela
                  </button>
                </>
              ) : null}
              {isTrumpChoice
                ? (pendingAction?.legalTrumpChoices ?? []).map((choice) =>
                    choice === "SKIP" ? (
                      <button
                        key={choice}
                        type="button"
                        className="suit-choice-button suit-choice-skip"
                        onClick={() => onChooseTrump(choice)}
                        aria-label="skip"
                      >
                        <div className="suit-choice-visual suit-choice-skip-visual" aria-hidden="true">
                          pass
                        </div>
                        <span className="suit-choice-label">skip</span>
                      </button>
                    ) : (
                      <SuitChoiceButton key={choice} choice={choice} onChoose={onChooseTrump} />
                    )
                  )
                : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function gameCompleteWinnerMessage(summary: GameCompleteSummary | null) {
  if (!summary) {
    return "The game is over.";
  }

  return summary.byForfeit ? `${summary.winnerName} won the game by forfeit.` : `${summary.winnerName} won the game.`;
}

function matchCompleteSubtitle(summary: MatchCompleteSummary | null) {
  if (!summary) {
    return "The match is over. Set the next table when you are ready.";
  }

  return `${summary.winnerName} win the match ${summary.winnerMatchWins}-${summary.loserMatchWins}.`;
}

function GameCompleteSummaryPanel({ summary }: { summary: GameCompleteSummary }) {
  return (
    <div className="game-complete-grid">
      <section className="game-complete-box" aria-label="Match and game settings">
        <div className="game-complete-box-title">Settings</div>
        <div className="game-complete-box-row">
          <span>Match length</span>
          <strong>
            First to {summary.matchTargetWins} game{summary.matchTargetWins === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="game-complete-box-row">
          <span>Game length</span>
          <strong>{summary.nextGameTargetPoints} points</strong>
        </div>
      </section>
      <section className="game-complete-box" aria-label="Current standings">
        <div className="game-complete-box-title">Standings</div>
        <div className="game-complete-score-rows">
          <div className="game-complete-score-row game-complete-score-row-winner">
            <span>{summary.winnerName}</span>
            <strong>
              {summary.winnerMatchWins} MP · {summary.winnerGamePoints} GP
            </strong>
          </div>
          <div className="game-complete-score-row">
            <span>{summary.loserName}</span>
            <strong>
              {summary.loserMatchWins} MP · {summary.loserGamePoints} GP
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function MatchCompleteSummaryPanel({ summary }: { summary: MatchCompleteSummary }) {
  return (
    <div className="between-games-result-grid">
      <div className="between-games-outcome">
        <p className="between-games-outcome-line">
          <strong>{summary.winnerName}</strong>
          {" win the match"}
        </p>
      </div>
      <div className="match-complete-grid" aria-label="Final match score">
        <div className="match-complete-team match-complete-team-winner">{summary.winnerName}</div>
        <div className="match-complete-team">{summary.loserName}</div>
        <div className="match-complete-score match-complete-score-winner">{summary.winnerMatchWins}</div>
        <div className="match-complete-score">{summary.loserMatchWins}</div>
      </div>
      <div className="between-games-matchline">
        Final game: {summary.finalGameWinnerPoints}-{summary.finalGameLoserPoints}
        {summary.finalGameByForfeit ? " by forfeit." : "."}
      </div>
      <div className="between-games-matchline">
        Match target: first to {summary.matchTargetWins} game{summary.matchTargetWins === 1 ? "" : "s"}.
      </div>
    </div>
  );
}

function MeldSetSection({ meldSet }: { meldSet: MeldSetView | null }) {
  if (!meldSet) {
    return <p className="panel-caption">No melds available.</p>;
  }

  return (
    <div className="meld-popup-stack meld-popup-player-block">
      <div className="meld-detail-row">
        <span className="panel-caption">player</span>
        <span className="meld-detail-separator" aria-hidden="true">
          {" : "}
        </span>
        <strong>{meldSet.playerName}</strong>
        <span className="meld-detail-separator" aria-hidden="true">
          {" : "}
        </span>
        <strong>{meldSet.totalPoints}</strong>
      </div>
      {meldSet.melds.map((meld) => (
        <div key={`${meld.kind}-${meld.label}-${meld.points}`} className="meld-combination-block">
          <div className="meld-detail-row">
            <span className="panel-caption">meld</span>
            <span className="meld-detail-separator" aria-hidden="true">
              {" : "}
            </span>
            <strong>{formatMeldLabel(meld.label)}</strong>
          </div>
          <div className="meld-card-row">
            {meld.cards.map((card) => (
              <PlayingCard key={`${card.label}-${card.suit}-${card.rank}`} card={card} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MeldWinnerSection({ meldWinner }: { meldWinner: MeldWinnerView | null }) {
  if (!meldWinner) {
    return <p className="panel-caption">No melds this game.</p>;
  }

  return (
    <div className="meld-popup-stack">
      <div className="meld-detail-row">
        <span className="panel-caption">team</span>
        <span className="meld-detail-separator" aria-hidden="true">
          {" : "}
        </span>
        <strong>{meldWinner.teamName}</strong>
      </div>
      {meldWinner.players.map((meldSet) => (
        <MeldSetSection key={`${meldSet.playerId}-${meldSet.totalPoints}`} meldSet={meldSet} />
      ))}
    </div>
  );
}

function formatMeldLabel(label: string) {
  return label.toLowerCase();
}

interface TeamSettingsRowProps {
  heading: string;
  teamLabel: string;
  teamValue: string;
  onTeamChange: (value: string) => void;
  firstPlayerLabel: string;
  firstPlayerValue: string;
  onFirstPlayerChange: (value: string) => void;
  secondPlayerLabel: string;
  secondPlayerValue: string;
  onSecondPlayerChange: (value: string) => void;
}

function TeamSettingsRow({
  heading,
  teamLabel,
  teamValue,
  onTeamChange,
  firstPlayerLabel,
  firstPlayerValue,
  onFirstPlayerChange,
  secondPlayerLabel,
  secondPlayerValue,
  onSecondPlayerChange
}: TeamSettingsRowProps) {
  return (
    <section className="team-settings-row">
      <div className="team-settings-label">
        <span className="panel-caption">team</span>
        <strong>{heading}</strong>
      </div>
      <label className="name-setting-field team-name-field">
        <span className="panel-caption">{teamLabel}</span>
        <input type="text" value={teamValue} maxLength={30} onChange={(event) => onTeamChange(event.target.value)} />
      </label>
      <label className="name-setting-field player-name-field">
        <span className="panel-caption">{firstPlayerLabel}</span>
        <input type="text" value={firstPlayerValue} maxLength={24} onChange={(event) => onFirstPlayerChange(event.target.value)} />
      </label>
      <label className="name-setting-field player-name-field">
        <span className="panel-caption">{secondPlayerLabel}</span>
        <input type="text" value={secondPlayerValue} maxLength={24} onChange={(event) => onSecondPlayerChange(event.target.value)} />
      </label>
    </section>
  );
}

function SettingGroup({
  label,
  children,
  boxed = false,
  className = ""
}: {
  label: string;
  children: ReactNode;
  boxed?: boolean;
  className?: string;
}) {
  return (
    <section className={`setting-group ${boxed ? "setting-group-boxed" : ""} ${className}`.trim()}>
      <span className="panel-caption">{label}</span>
      <div className="setting-pill-row">{children}</div>
    </section>
  );
}

export default ActionPanel;
