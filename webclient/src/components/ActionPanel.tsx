import type { ReactNode } from "react";
import type { GameSettingsDrafts, PendingAction, PlayerNameDrafts, TeamNameDrafts } from "../types";
import SuitChoiceButton from "./SuitChoiceButton";

interface ActionPanelProps {
  pendingAction?: PendingAction;
  startScreenPhase: "boot-loading" | "ready";
  errorMessage: string | null;
  playerNames: PlayerNameDrafts;
  teamNames: TeamNameDrafts;
  gameSettings: GameSettingsDrafts;
  gameWinMessage: string | null;
  onPlayerNameChange: (seat: keyof PlayerNameDrafts, value: string) => void;
  onTeamNameChange: (team: keyof TeamNameDrafts, value: string) => void;
  onGameSettingsChange: (patch: Partial<GameSettingsDrafts>) => void;
  onStart: () => void;
  onChooseTrump: (choice: string) => void;
}

function ActionPanel({
  pendingAction,
  startScreenPhase,
  errorMessage,
  playerNames,
  teamNames,
  gameSettings,
  gameWinMessage,
  onPlayerNameChange,
  onTeamNameChange,
  onGameSettingsChange,
  onStart,
  onChooseTrump
}: ActionPanelProps) {
  const isStart = pendingAction?.type === "START_MATCH";
  const isNextGame = pendingAction?.type === "START_NEXT_GAME";
  const isTrumpChoice = pendingAction?.type === "CHOOSE_TRUMP";
  const isBootLoading = isStart && startScreenPhase === "boot-loading";
  const isPopupVisible = isStart || isNextGame || isTrumpChoice;

  if (!isPopupVisible) {
    return null;
  }

  const title = isStart ? "Start the match" : isNextGame ? "Game complete" : "Choose the trump suit";
  const subtitle = isStart
    ? "Set the table, the pace, and the people before the first deal."
    : isNextGame
      ? gameWinMessage ?? "That game is done. Take a breath and deal the next one."
      : pendingAction?.prompt || "Choose the trump suit or skip.";

  return (
    <div
      className={`action-overlay ${
        isTrumpChoice ? "action-overlay-trump" : isNextGame ? "action-overlay-next-game" : "action-overlay-start"
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
              {isNextGame ? (
                <div className="between-games-summary">
                  <div className="between-games-chip">next stop</div>
                  <p>
                    First to {gameSettings.matchTargetWins} game{gameSettings.matchTargetWins === 1 ? "" : "s"} wins the match.
                  </p>
                  <p>The next game plays to {gameSettings.gameLength === "SHORT" ? 501 : 1001} points.</p>
                </div>
              ) : null}
            </div>
            <div className={`action-controls ${isTrumpChoice ? "trump-controls" : ""}`}>
              {isNextGame ? (
                <button type="button" className="action-button action-button-primary" onClick={onStart}>
                  Deal the next game
                </button>
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
